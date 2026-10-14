// Real reauthorization test on PayPal SANDBOX (Oct 14, 2026), on the local test
// agent "Office procurement" (owner Osteen, not the demo account). Its holds were
// authorized Oct 9, so PayPal's 3-day honor period is over.
//   part 1 "paper": direct PayPal calls on the Paper Co hold -
//     capture $1 with no reauthorization, reauthorize, capture $1 on the new ID,
//     capture $1 on the ORIGINAL ID, then read both IDs back. The local database
//     is then brought in line with PayPal (new current ID, honor period, captured).
//   part 2 "bean": the app's own code on the Bean Supply hold - the daily job's
//     renewal, then one small purchase through the spending service.
//   part 3 "revoke": revokes the test agent with the app's own revoke (Osteen's
//     choice), which voids every hold on its ORIGINAL ID, then reads both IDs back.
// Never prints raw SDK errors (they carry the bearer token): status + issue only.
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/reauth-test.ts paper|bean

import { randomUUID } from "node:crypto";
import { PaymentsController } from "@paypal/paypal-server-sdk";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, holds, slips, stores } from "@/db/schema";
import { call, PayPalError, paypalClient } from "@/lib/paypal/client";
import { captureFromHold, reauthorizeHold } from "@/lib/paypal/holds";
import { addDays } from "@/lib/services/common";
import { HONOR_PERIOD_DAYS } from "@/lib/services/slips";
import { reauthorizeDueHolds } from "@/lib/services/reauth";
import { createSpendRequest } from "@/lib/services/spend";
import { revokeAgent } from "@/lib/services/agents";
import { spendRequests } from "@/db/schema";

const PAPER_HOLD = "3817a984";
const BEAN_HOLD = "9fe843db";
const part = process.argv[2];

const why = (e: unknown) =>
  e instanceof PayPalError ? `FAILED ${e.status} ${e.issue ?? ""}`.trim() : `FAILED ${e instanceof Error ? e.name : "error"}`;

async function findHold(prefix: string) {
  const [row] = await db
    .select({ hold: holds, agent: agents, merchantId: stores.paypalMerchantId, store: stores.name })
    .from(holds)
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .innerJoin(agents, eq(agents.id, slips.agentId))
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .where(and(sql`${holds.id}::text like ${prefix + "%"}`, eq(agents.name, "Office procurement"), eq(holds.status, "ACTIVE")));
  if (!row) throw new Error(`no active hold ${prefix} for the test agent`);
  return row;
}

async function readAuth(id: string) {
  try {
    const a = await call("get authorization", () => new PaymentsController(paypalClient()).getAuthorizedPayment({ authorizationId: id }));
    return `${a.status}${a.statusDetails?.reason ? ` (${a.statusDetails.reason})` : ""}, amount ${a.amount?.value}, expires ${a.expirationTime}`;
  } catch (e) {
    return why(e);
  }
}

async function capture(label: string, authorizationId: string): Promise<number> {
  try {
    const c = await captureFromHold({ authorizationId, amountCents: 100, spendRequestId: `reauth-test-${randomUUID()}` });
    console.log(`  ${label}: OK capture ${c.captureId} ${c.status}`);
    return 100;
  } catch (e) {
    console.log(`  ${label}: ${why(e)}`);
    return 0;
  }
}

if (part === "paper") {
  const { hold, store, merchantId } = await findHold(PAPER_HOLD);
  const original = hold.paypalAuthorizationId!;
  console.log(`${store} hold ${hold.id.slice(0, 8)}: original auth ${original}, current ${hold.paypalCurrentAuthorizationId ?? "-"}`);
  console.log(`  before: ${await readAuth(original)}`);
  let captured = 0;

  captured += await capture("1. capture $1 on ORIGINAL, no reauthorization (day 4+)", original);

  let renewed: string | null = null;
  try {
    const r = await reauthorizeHold({ authorizationId: original, storeMerchantId: merchantId, amountCents: hold.amountCents });
    renewed = r.authorizationId;
    console.log(`  2. reauthorize: OK new auth ${renewed} ${r.status}`);
  } catch (e) {
    console.log(`  2. reauthorize: ${why(e)}`);
  }

  if (renewed) {
    captured += await capture("3. capture $1 on NEW ID", renewed);
    captured += await capture("4. capture $1 on ORIGINAL ID after reauthorization", original);
    console.log(`  5. original now: ${await readAuth(original)}`);
    console.log(`     new now:      ${await readAuth(renewed)}`);
  }

  // Keep the local database in line with PayPal.
  await db
    .update(holds)
    .set({
      capturedCents: sql`${holds.capturedCents} + ${captured}`,
      ...(renewed ? { paypalCurrentAuthorizationId: renewed, honorPeriodEndsAt: addDays(new Date(), HONOR_PERIOD_DAYS) } : {}),
    })
    .where(eq(holds.id, hold.id));
  console.log(`  database: +$${(captured / 100).toFixed(2)} captured${renewed ? `, current auth ${renewed}` : ""}`);
} else if (part === "paper2") {
  // Retry of step 2: reauthorize only what is left of the hold (PayPal refused
  // the default, which is the full original amount, on a partly captured hold).
  const { hold, store, merchantId } = await findHold(PAPER_HOLD);
  const original = hold.paypalAuthorizationId!;
  const left = hold.amountCents - hold.capturedCents;
  console.log(`${store} hold ${hold.id.slice(0, 8)}: $${(left / 100).toFixed(2)} left of $${(hold.amountCents / 100).toFixed(2)}`);
  let captured = 0;
  let renewed: string | null = null;
  try {
    const r = await call("reauthorize", () =>
      new PaymentsController(paypalClient()).reauthorizePayment({
        authorizationId: original,
        paypalRequestId: `reauth-test-${randomUUID()}`,
        prefer: "return=representation",
        body: { amount: { currencyCode: "USD", value: (left / 100).toFixed(2) } },
      }),
    );
    renewed = r.id ?? null;
    console.log(`  2b. reauthorize $${(left / 100).toFixed(2)}: OK new auth ${renewed} ${r.status}, amount ${r.amount?.value}, expires ${r.expirationTime}`);
  } catch (e) {
    console.log(`  2b. reauthorize $${(left / 100).toFixed(2)}: ${why(e)}`);
  }
  if (renewed) {
    captured += await capture("3. capture $1 on NEW ID", renewed);
    captured += await capture("4. capture $1 on ORIGINAL ID after reauthorization", original);
    console.log(`  5. original now: ${await readAuth(original)}`);
    console.log(`     new now:      ${await readAuth(renewed)}`);
  }
  await db
    .update(holds)
    .set({
      capturedCents: sql`${holds.capturedCents} + ${captured}`,
      ...(renewed ? { paypalCurrentAuthorizationId: renewed, honorPeriodEndsAt: addDays(new Date(), HONOR_PERIOD_DAYS) } : {}),
    })
    .where(eq(holds.id, hold.id));
  console.log(`  database: +$${(captured / 100).toFixed(2)} captured${renewed ? `, current auth ${renewed}` : ""}`);
} else if (part === "bean") {
  // The app's own code: the daily job's renewal, then one real purchase.
  const before = await findHold(BEAN_HOLD);
  const original = before.hold.paypalAuthorizationId!;
  console.log(`${before.store} hold ${before.hold.id.slice(0, 8)}: $${((before.hold.amountCents - before.hold.capturedCents) / 100).toFixed(2)} left, original ${original}, current ${before.hold.paypalCurrentAuthorizationId ?? "-"}`);

  const renewedCount = await reauthorizeDueHolds();
  const after = await findHold(BEAN_HOLD);
  const current = after.hold.paypalCurrentAuthorizationId;
  console.log(`  6. daily job renewal: ${renewedCount} hold(s) renewed; Bean current auth ${current ?? "- (NOT renewed)"}, honor period ends ${after.hold.honorPeriodEndsAt?.toISOString()}`);
  if (current) console.log(`     new now:      ${await readAuth(current)}`);

  const { row } = await createSpendRequest(after.agent.id, `reauth-test-${randomUUID()}`, {
    store_id: after.hold.storeId,
    items: [{ name: "Ground coffee, house blend, 12 oz", category: "groceries", quantity: 1, unit_amount_cents: 949, product_url: "http://localhost:3001/shop/bean-supply/ground-coffee" }],
    total: { amount_cents: 949, currency: "USD" },
    purpose: "Coffee for the office kitchen.",
  });
  const [spend] = await db.select({ status: spendRequests.status, captureAuth: spendRequests.captureAuthorizationId }).from(spendRequests).where(eq(spendRequests.id, row.id));
  console.log(`  7. app purchase $9.49: ${spend?.status}, captured on ${spend?.captureAuth ?? "-"} (${spend?.captureAuth && spend.captureAuth === current ? "the NEW ID" : spend?.captureAuth === original ? "the ORIGINAL ID" : "?"})`);
  console.log(`     original now: ${await readAuth(original)}`);
} else if (part === "revoke") {
  const paper = await findHold(PAPER_HOLD);
  const bean = await findHold(BEAN_HOLD);
  const { holdsReleased } = await revokeAgent(paper.agent.ownerId, paper.agent.id);
  console.log(`  8. revoke "${paper.agent.name}": ${holdsReleased} hold(s) released`);
  for (const h of [paper, bean]) {
    const [now] = await db.select({ status: holds.status }).from(holds).where(eq(holds.id, h.hold.id));
    console.log(`  ${h.store} hold ${h.hold.id.slice(0, 8)} in Cosign: ${now?.status}`);
    console.log(`     original ${h.hold.paypalAuthorizationId}: ${await readAuth(h.hold.paypalAuthorizationId!)}`);
    if (h.hold.paypalCurrentAuthorizationId) console.log(`     renewed  ${h.hold.paypalCurrentAuthorizationId}: ${await readAuth(h.hold.paypalCurrentAuthorizationId)}`);
  }
} else {
  console.log("usage: reauth-test.ts paper|paper2|bean|revoke");
}
await (db.$client as { end: () => Promise<void> }).end();
