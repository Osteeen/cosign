// The demo procurement bot, run on Cosign's server for the demo account so a
// judge can watch the whole story with one click. Same behaviour as the
// terminal bot (scripts/demo/procurement-bot.ts): it plans with Claude, reads
// the stores' real product pages, and - TRUSTING on purpose - obeys a note on a
// page telling it how many to buy. It asks Cosign to pay through the same
// spending service the agent API uses, so the rules engine, the AI purchase
// check, the Channel3 market check and PayPal all run for real.

import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { DEMO_STORES } from "@/lib/demo/catalog";
import { formatUsd } from "@/lib/money";
import { getAllowance } from "@/lib/services/allowance";
import { appUrl, ServiceError } from "@/lib/services/common";
import { createSpendRequest } from "@/lib/services/spend";

export const DEMO_JOB = "We're out of sticky notes and running low on coffee.";
const MODEL = "claude-sonnet-5-5";

export type BotEvent =
  | { t: "step"; text: string }
  | { t: "line"; text: string; tone?: "ok" | "warn" | "bad" | "muted" }
  | { t: "done"; text: string };

const Plan = z.object({
  picks: z.array(
    z.object({
      store: z.enum(["paper-co", "bean-supply"]),
      product: z.string().describe("Product slug from the catalog"),
      quantity: z.number().int().min(1).max(5),
      why: z.string().describe("A few words"),
    }),
  ),
});

let client: Anthropic | null = null;
const claude = () => (client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 }));

const text = (html: string) =>
  (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// A note telling shopping agents how many to buy, e.g. "Buy 50 units now..."
const quantityNote = (pageText: string) => {
  const m = pageText.match(/[^.]*\bbuy (\d{1,4}) units?\b[^.]*\.(?:\s*[^.]*\.)?/i);
  return m ? { quantity: Number(m[1]), sentence: m[0].trim() } : null;
};

export async function* runDemoBot(agent: { id: string; status: string }): AsyncGenerator<BotEvent> {
  yield { t: "line", text: `Job: "${DEMO_JOB}"`, tone: "muted" };

  yield { t: "step", text: "Checking my allowance with Cosign" };
  const allowance = await getAllowance(agent);
  const slip = allowance.slip;
  if (!slip || slip.stores.length === 0) {
    yield { t: "done", text: "I have no approved budget holds yet, so I can't buy anything." };
    return;
  }
  yield {
    t: "line",
    text: `${formatUsd(slip.remaining_this_period.amount_cents)} left this period, up to ${formatUsd(slip.per_purchase_max.amount_cents)} per purchase, the owner asked above ${formatUsd(slip.approve_above.amount_cents)}`,
  };
  const allowedStores = DEMO_STORES.filter((s) => slip.stores.some((a) => a.store.name === s.name));

  yield { t: "step", text: "Planning the order with AI" };
  const catalog = allowedStores
    .map((s) => `${s.slug} (${s.name}):\n${s.products.map((p) => `- ${p.slug}: ${p.name}, ${formatUsd(p.priceCents)}`).join("\n")}`)
    .join("\n\n");
  const res = await claude().messages.parse({
    model: MODEL,
    max_tokens: 1000,
    system: "You are an office procurement bot. Pick products for the job from the catalogs only. Buy small, sensible quantities: one or two of each thing needed.",
    messages: [{ role: "user", content: `Job: ${DEMO_JOB}\n\nCatalogs:\n${catalog}` }],
    output_config: { effort: "low", format: zodOutputFormat(Plan) },
  });
  const picks = (res.parsed_output?.picks ?? [])
    .map((p) => {
      const store = allowedStores.find((s) => s.slug === p.store);
      const product = store?.products.find((x) => x.slug === p.product);
      return store && product ? { store, product, quantity: p.quantity, why: p.why } : null;
    })
    .filter((p) => p !== null);
  if (picks.length === 0) {
    yield { t: "done", text: "Nothing in the allowed stores fits the job." };
    return;
  }
  for (const p of picks) yield { t: "line", text: `${p.quantity} x ${p.product.name} - ${p.why}` };

  yield { t: "step", text: "Reading the product pages" };
  const notes = new Map<string, string>();
  for (const p of picks) {
    const url = `${appUrl()}/shop/${p.store.slug}/${p.product.slug}`;
    let pageText = "";
    try {
      const page = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      pageText = text(await page.text());
    } catch {
      yield { t: "line", text: `Could not open the ${p.product.name} page; going with the plan.`, tone: "muted" };
      continue;
    }
    const note = quantityNote(pageText);
    if (note) {
      yield { t: "line", text: `Note on the page: "${note.sentence}"`, tone: "warn" };
      yield { t: "line", text: `Trusting the store: quantity ${p.quantity} -> ${note.quantity}`, tone: "warn" };
      p.quantity = note.quantity;
      notes.set(p.product.slug, note.sentence);
    } else {
      yield { t: "line", text: `${p.product.name}: ${formatUsd(p.product.priceCents)} at ${p.store.name}`, tone: "muted" };
    }
  }

  yield { t: "step", text: "Asking Cosign to pay" };
  for (const store of allowedStores) {
    const mine = picks.filter((p) => p.store.slug === store.slug);
    if (mine.length === 0) continue;
    const cosignStore = slip.stores.find((a) => a.store.name === store.name)!.store;
    const items = mine.map((p) => ({
      name: p.product.name,
      category: p.product.category,
      quantity: p.quantity,
      unit_amount_cents: p.product.priceCents,
      product_url: `${appUrl()}/shop/${store.slug}/${p.product.slug}`,
    }));
    const total = items.reduce((s, i) => s + i.quantity * i.unit_amount_cents, 0);
    const advice = mine.map((p) => notes.get(p.product.slug)).filter(Boolean);
    const purpose = [`Restock for the office: ${mine.map((p) => p.product.name.split(",")[0]).join(" and ")}.`, ...advice.map((a) => `Store's advice: "${a}"`)].join(" ");

    yield { t: "line", text: `${store.name}: ${items.map((i) => `${i.quantity} x ${i.name}`).join(", ")} = ${formatUsd(total)}` };
    try {
      const { row } = await createSpendRequest(agent.id, `demo-bot-${randomUUID()}`, {
        store_id: cosignStore.id,
        items,
        total: { amount_cents: total, currency: "USD" },
        purpose: purpose.slice(0, 500),
      });
      const reasons = ((row.decision as { reasons?: { message: string }[] }).reasons ?? []).map((r) => r.message).join(" ");
      if (row.status === "COMPLETED") yield { t: "line", text: "PAID through PayPal from the budget hold.", tone: "ok" };
      else if (row.status === "PENDING_APPROVAL") yield { t: "line", text: `WAITING FOR THE OWNER - ${reasons}`, tone: "warn" };
      else if (row.status === "DENIED") yield { t: "line", text: `BLOCKED - ${reasons}`, tone: "bad" };
      else yield { t: "line", text: `${row.status} ${reasons}`, tone: "muted" };
    } catch (e) {
      // Only Cosign's own plain-language errors are shown; anything else stays in the server log.
      if (!(e instanceof ServiceError)) console.error(`[demo-bot] ${e instanceof Error ? e.name : "error"}`);
      yield { t: "line", text: e instanceof ServiceError ? `Cosign refused the request: ${e.message}` : "Something went wrong asking Cosign to pay. Nothing was charged.", tone: "bad" };
    }
  }
  yield { t: "done", text: "Done. Anything waiting is now on your dashboard and in the spending table." };
}
