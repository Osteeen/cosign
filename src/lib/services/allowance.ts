// What an agent may spend right now. Shared by the REST agent API and the MCP
// server so both always tell an agent the same thing.

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { holds, slips, stores } from "@/db/schema";
import { appUrl } from "./common";
import { rollOverAgentIfDue } from "./slips";

// Demo stores keep their website as a path in this app; agents always get a full URL.
const absolute = (website: string | null) => (website ? new URL(website, `${appUrl()}/`).href : null);

const usd = (cents: number) => ({ amount_cents: cents, currency: "USD" as const });

export async function getAllowance(agent: { id: string; status: string }) {
  await rollOverAgentIfDue(agent.id);
  const [slip] = await db
    .select()
    .from(slips)
    .where(and(eq(slips.agentId, agent.id), eq(slips.status, "ACTIVE")));
  if (!slip) return { agent_id: agent.id, status: agent.status, slip: null };

  const periodHolds = await db
    .select({ hold: holds, storeName: stores.name, storeCategories: stores.categories, storeWebsite: stores.website })
    .from(holds)
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .where(and(eq(holds.slipId, slip.id), eq(holds.periodIndex, slip.currentPeriodIndex)));
  const committed = periodHolds.reduce((s, h) => s + h.hold.capturedCents + h.hold.reservedCents, 0);

  return {
    agent_id: agent.id,
    status: agent.status,
    slip: {
      slip_id: slip.id,
      period_days: slip.periodDays,
      period_ends_at: slip.currentPeriodEndsAt.toISOString(),
      remaining_this_period: usd(Math.max(slip.periodBudgetCents - committed, 0)),
      per_purchase_max: usd(slip.perPurchaseMaxCents),
      approve_above: usd(slip.approveAboveCents),
      categories: slip.categories,
      expires_at: slip.expiresAt?.toISOString() ?? null,
      stores: periodHolds
        .filter((h) => h.hold.status === "ACTIVE")
        .map((h) => ({
          store: { id: h.hold.storeId, name: h.storeName, categories: h.storeCategories, website: absolute(h.storeWebsite) },
          remaining_in_hold: usd(h.hold.amountCents - h.hold.capturedCents - h.hold.reservedCents),
        })),
    },
  };
}
