// Read-only: lists the local test holds the reauthorization test uses.
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/reauth-holds.ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, holds, slips, stores } from "@/db/schema";

const rows = await db
  .select({ agent: agents.name, agentId: agents.id, agentStatus: agents.status, owner: agents.ownerId, store: stores.name, hold: holds })
  .from(holds)
  .innerJoin(slips, eq(slips.id, holds.slipId))
  .innerJoin(agents, eq(agents.id, slips.agentId))
  .innerJoin(stores, eq(stores.id, holds.storeId))
  .where(eq(holds.status, "ACTIVE"));
for (const r of rows) {
  const h = r.hold;
  console.log(
    `${r.agent} [${r.agentStatus}] owner=${r.owner === "demo-owner" ? "demo" : "osteen"} | ${r.store} hold ${h.id.slice(0, 8)} $${(h.amountCents / 100).toFixed(2)} captured $${(h.capturedCents / 100).toFixed(2)} | auth ${h.paypalAuthorizationId} current ${h.paypalCurrentAuthorizationId ?? "-"} | authorized ${h.authorizedAt?.toISOString() ?? "?"} honorEnds ${h.honorPeriodEndsAt?.toISOString()} expires ${h.expiresAt?.toISOString()}`,
  );
}
await (db.$client as { end: () => Promise<void> }).end();
