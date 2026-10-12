// Channel3 market price check for a purchase waiting for the owner. Runs in the
// background before the approval email; never throws and never changes the
// decision - it only adds market prices for the owner to weigh.

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { spendRequests } from "@/db/schema";
import { judgeMarket } from "@/lib/ai/market-check";
import { searchMarket, type MarketOffer } from "@/lib/market/channel3";
import { rateLimit } from "@/lib/api";

const MAX_ITEMS = 3;
// A misbehaving agent must not burn the Channel3 quota or AI spend.
const PER_AGENT_PER_HOUR = 20;

export type MarketCheck = {
  status: "ok" | "unavailable";
  checked_at: string;
  items: { name: string; verdict: "below" | "about" | "above" | "none"; note: string; offers: MarketOffer[] }[];
};

export async function runMarketCheck(spendRequestId: string): Promise<MarketCheck | null> {
  try {
    const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, spendRequestId));
    if (!row || row.status !== "PENDING_APPROVAL") return null;
    if (row.marketCheck) return row.marketCheck as MarketCheck;
    if (!rateLimit(`market:${row.agentId}`, PER_AGENT_PER_HOUR, 3_600_000).ok) return null;

    const items = (row.items as { name: string; quantity: number; unit_amount_cents: number }[]).slice(0, MAX_ITEMS);
    const results: MarketCheck["items"] = [];
    let reachable = false;
    for (const item of items) {
      const listings = await searchMarket(item.name);
      if (listings === null) continue;
      reachable = true;
      const judged = await judgeMarket({ name: item.name, quantity: item.quantity, unitAmountCents: item.unit_amount_cents }, listings);
      if (judged) results.push({ name: item.name, ...judged });
    }
    const check: MarketCheck = { status: reachable && results.length ? "ok" : "unavailable", checked_at: new Date().toISOString(), items: results };
    await db.update(spendRequests).set({ marketCheck: check }).where(eq(spendRequests.id, spendRequestId));
    return check;
  } catch (e) {
    console.error(`[market] check failed (${e instanceof Error ? e.name : "error"})`);
    return null;
  }
}

// One line for the owner, e.g. "About market price - walmart.com $16.07, target.com $16.73".
export function marketSummary(check: MarketCheck | null | undefined): string | null {
  if (!check || check.status !== "ok") return null;
  const first = check.items[0];
  if (!first) return null;
  if (first.verdict === "none") return "No comparable listings on Channel3";
  const word = first.verdict === "below" ? "Below market price" : first.verdict === "above" ? "Above market price" : "About market price";
  return `${word} - ${first.offers.map((o) => `${o.domain} $${o.price.toFixed(2)}`).join(", ")}`;
}

// What an approval card shows: the summary line and the model's short note.
export function cardMarket(raw: unknown): { summary: string; note: string | null } | null {
  const check = raw as MarketCheck | null;
  const summary = marketSummary(check);
  if (!summary) return null;
  const first = check!.items[0]!;
  return { summary, note: first.verdict === "none" ? null : first.note };
}
