// Sandbox test of hold recovery (Oct 14, 2026), on LOCAL data only.
//  A: the authorization read back from a placed order matches what we stored.
//  B: an ACTIVE local demo hold is set back to "waiting" as if PayPal's answer
//     was lost; the daily sweep must restore it with the same authorization and
//     its original times (no money moves).
//  C: the revoked test agent's already-voided Paper Co hold loses its recorded
//     authorization as if never known; the sweep must find it and release it
//     (PayPal answers "already voided"; nothing real is touched).
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/hold-recovery-test.ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, agents, holds, slips, stores } from "@/db/schema";
import { getOrder } from "@/lib/paypal/holds";
import { recoverWaitingHolds } from "@/lib/services/slips";

const [demo] = await db
  .select({ hold: holds })
  .from(holds)
  .innerJoin(slips, eq(slips.id, holds.slipId))
  .innerJoin(agents, eq(agents.id, slips.agentId))
  .innerJoin(stores, eq(stores.id, holds.storeId))
  .where(and(eq(agents.ownerId, "demo-owner"), eq(stores.name, "Paper Co"), eq(holds.status, "ACTIVE")));
const h = demo!.hold;

const order = await getOrder(h.paypalOrderId!);
console.log(`A. order ${order.status}; read back ${order.placed?.authorizationId} (stored ${h.paypalAuthorizationId}) ${order.placed?.authorizationId === h.paypalAuthorizationId ? "MATCH" : "DIFFERENT"}; authorized ${order.placed?.authorizedAt?.toISOString()} (stored ${h.authorizedAt?.toISOString()})`);

await db.update(holds).set({ status: "AWAITING_APPROVAL", paypalAuthorizationId: null, authorizedAt: null, honorPeriodEndsAt: null, expiresAt: null }).where(eq(holds.id, h.id));
const [testHold] = await db
  .select({ hold: holds })
  .from(holds)
  .where(sql`${holds.id}::text like '3817a984%'`);
const t = testHold!.hold;
await db.update(holds).set({ paypalAuthorizationId: null, releasedAt: new Date() }).where(eq(holds.id, t.id));

const recovered = await recoverWaitingHolds();
const [after] = await db.select().from(holds).where(eq(holds.id, h.id));
console.log(`B. sweep recovered ${recovered}; demo hold now ${after!.status}, auth ${after!.paypalAuthorizationId === h.paypalAuthorizationId ? "SAME" : after!.paypalAuthorizationId}, honor ends ${after!.honorPeriodEndsAt?.toISOString()} (was ${h.honorPeriodEndsAt?.toISOString()}), expires ${after!.expiresAt?.toISOString()} (was ${h.expiresAt?.toISOString()})`);
const [tAfter] = await db.select().from(holds).where(eq(holds.id, t.id));
const [logged] = await db.select({ type: activityEvents.type, summary: activityEvents.summary }).from(activityEvents).where(and(eq(activityEvents.ownerId, t.ownerId), sql`${activityEvents.data}->>'recovered' = 'true'`));
console.log(`C. closed hold auth restored ${tAfter!.paypalAuthorizationId === t.paypalAuthorizationId ? "SAME" : tAfter!.paypalAuthorizationId}; logged ${logged?.type}: ${logged?.summary}`);
await (db.$client as { end: () => Promise<void> }).end();
