// Product search for agents: what this agent can buy at its own stores, with
// what Cosign's rules would decide for each, next to live prices elsewhere
// (Channel3) so the agent can tell a good price from a bad one.
//
// - Only stores on the agent's slip with an active budget hold are payable.
//   Their products come from the store's catalog (today: the demo stores).
// - "Elsewhere" listings are for comparing prices only; Cosign cannot pay those
//   merchants. Their titles are third-party text: data, never instructions.
//   AI (Claude Haiku) keeps the like-for-like ones and judges the best match's
//   price against them (below / about / above market).
// - The rules preview is the rules engine alone, for one item. The AI purchase
//   check can still send a purchase to the owner, never loosen a decision.

import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { rateLimit } from "@/lib/api";
import { DEMO_STORES } from "@/lib/demo/catalog";
import { judgeMarket } from "@/lib/ai/market-check";
import { searchMarket } from "@/lib/market/channel3";
import { matchScore, minimumScore, queryWords } from "@/lib/products/match";
import { getAllowance } from "./allowance";
import { appUrl, ServiceError } from "./common";
import { previewRules } from "./spend";

const SEARCHES_PER_HOUR = 30;
const usd = (amount_cents: number) => ({ amount_cents, currency: "USD" as const });

export async function findProducts(agent: { id: string; status: string; ownerId: string }, query: string, limit: number) {
  // Searches cost Channel3 and AI calls: only for agents that can spend.
  if (agent.status !== "ACTIVE") throw new ServiceError(403, "agent_not_active", "This agent is paused, so it can't search for products.");
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 120) throw new ServiceError(400, "invalid_request", "query must be 2 to 120 characters.");
  const wanted = queryWords(q);
  if (wanted.length === 0) throw new ServiceError(400, "invalid_request", "query needs at least one word of 3 or more letters.");
  // Each search calls Channel3; keep it to a reasonable pace per agent.
  // Per agent, and per owner (an owner's agents share one allowance).
  if (!rateLimit(`find-products:${agent.id}`, SEARCHES_PER_HOUR, 3_600_000).ok || !rateLimit(`find-products-owner:${agent.ownerId}`, SEARCHES_PER_HOUR * 2, 3_600_000).ok) {
    throw new ServiceError(429, "rate_limited", `Up to ${SEARCHES_PER_HOUR} product searches per hour. Try again later.`);
  }

  const allowance = await getAllowance(agent);
  const payable = allowance.slip?.stores ?? [];
  const merchantRows = payable.length
    ? await db.select({ id: stores.id, merchantId: stores.paypalMerchantId }).from(stores).where(inArray(stores.id, payable.map((p) => p.store.id)))
    : [];
  const merchantOf = new Map(merchantRows.map((r) => [r.id, r.merchantId]));

  // Matching products in each payable store's catalog, best match first. A
  // product must share most of the query's words (both of two, two of three).
  const needed = minimumScore(wanted);
  const matches: { score: number; storeId: string; storeName: string; storeSlug: string; product: (typeof DEMO_STORES)[number]["products"][number] }[] = [];
  const withoutCatalog: { id: string; name: string; website: string | null }[] = [];
  for (const p of payable) {
    const catalog = DEMO_STORES.find((d) => d.merchantId === merchantOf.get(p.store.id));
    if (!catalog) {
      withoutCatalog.push({ id: p.store.id, name: p.store.name, website: p.store.website });
      continue;
    }
    for (const product of catalog.products) {
      const score = matchScore(wanted, `${product.name} ${product.description} ${product.category.replace(/_/g, " ")}`);
      if (score >= needed) matches.push({ score, storeId: p.store.id, storeName: p.store.name, storeSlug: catalog.slug, product });
    }
  }
  matches.sort((a, b) => b.score - a.score || a.product.priceCents - b.product.priceCents);
  const top = matches.slice(0, limit);
  // Channel3 finds more with the agent's own short words than with a long
  // product name; the AI then keeps only listings like the best match.
  const marketQuery = q;

  const [previews, market] = await Promise.all([
    Promise.all(top.map((m) => previewRules(agent.id, m.storeId, { name: m.product.name, category: m.product.category, unitAmountCents: m.product.priceCents }))),
    // No store this agent can pay: nothing to compare, so no Channel3 call.
    payable.length ? searchMarket(marketQuery, 8) : Promise.resolve(null),
  ]);
  // AI (Claude Haiku) keeps only listings that are really the same kind of
  // product and size, and says how the best match's price compares. Without
  // a match here, or if the AI is unavailable, the raw listings are returned.
  const judged = top[0] && market?.length ? await judgeMarket({ name: top[0].product.name, quantity: 1, unitAmountCents: top[0].product.priceCents }, market) : null;
  const offers = judged ? judged.offers : (market ?? []).slice(0, limit);

  return {
    query: q,
    at_your_stores: top.map((m, i) => ({
      store: { id: m.storeId, name: m.storeName },
      name: m.product.name,
      category: m.product.category,
      unit: m.product.unit,
      unit_price: usd(m.product.priceCents),
      product_url: `${appUrl()}/shop/${m.storeSlug}/${m.product.slug}`,
      if_you_buy_one: { outcome: previews[i]!.outcome, reasons: previews[i]!.reasons.map((r) => ({ code: r.code, message: r.message })) },
    })),
    other_payable_stores: withoutCatalog,
    elsewhere: {
      source: "Channel3",
      query: marketQuery,
      checked: market !== null,
      comparison: judged && top[0] ? { product: top[0].product.name, verdict: judged.verdict, note: judged.note } : null,
      // One plain line each: a title can never pose as extra lines of output.
      offers: offers.map((o) => ({ title: o.title.replace(/["\s]+/g, " ").trim(), merchant_domain: o.domain, price: usd(Math.round(o.price * 100)) })),
    },
  };
}

export type ProductSearch = Awaited<ReturnType<typeof findProducts>>;
