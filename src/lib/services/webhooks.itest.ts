// Integration tests for verified PayPal webhook events (signature checking is
// in the route and needs PayPal itself). Runs against the cosign_test database
// (pnpm test:db); nothing here calls PayPal.

import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, agents, holds, slipStores, slips, spendRequests, stores, users } from "@/db/schema";
import { processPayPalEvent } from "./webhooks";

const HASH = "b".repeat(64);
const TOTAL = 2500;

async function fixture(spend: "PROCESSING" | "COMPLETED") {
  const ownerId = `test-owner-${randomUUID()}`;
  await db.insert(users).values({ id: ownerId, email: `${ownerId}@example.com` });
  const [store] = await db
    .insert(stores)
    .values({ name: "Test Store", categories: ["office_supplies"], paypalMerchantId: `TEST${randomUUID().slice(0, 8)}`, paypalTrackingId: `test-${randomUUID()}`, paymentsReceivable: true })
    .returning();
  const [agent] = await db.insert(agents).values({ ownerId, name: "Test agent" }).returning();
  const now = new Date();
  const [slip] = await db
    .insert(slips)
    .values({
      ownerId,
      agentId: agent!.id,
      status: "ACTIVE",
      periodDays: 28,
      periodBudgetCents: 10000,
      perPurchaseMaxCents: 10000,
      approveAboveCents: 5000,
      categories: ["office_supplies"],
      sourceText: "Test slip",
      currentPeriodStartsAt: now,
      currentPeriodEndsAt: new Date(now.getTime() + 28 * 86_400_000),
    })
    .returning();
  await db.insert(slipStores).values({ slipId: slip!.id, storeId: store!.id, allocationCents: 10000 });
  const authorizationId = `AUTH${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;
  const captureId = `CAP${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
  const [hold] = await db
    .insert(holds)
    .values({
      ownerId,
      slipId: slip!.id,
      storeId: store!.id,
      periodIndex: 0,
      status: "ACTIVE",
      amountCents: 10000,
      paypalAuthorizationId: authorizationId,
      reservedCents: spend === "PROCESSING" ? TOTAL : 0,
      capturedCents: spend === "COMPLETED" ? TOTAL : 0,
    })
    .returning();
  const [row] = await db
    .insert(spendRequests)
    .values({
      ownerId,
      agentId: agent!.id,
      slipId: slip!.id,
      storeId: store!.id,
      holdId: hold!.id,
      items: [{ name: "Paper", category: "office_supplies", quantity: 1, unit_amount_cents: TOTAL }],
      totalCents: TOTAL,
      currency: "USD",
      purpose: "Test purchase",
      cartHash: HASH,
      status: spend,
      decision: { outcome: "ALLOW", reasons: [], rule_version: 1, intent_check: null },
      idempotencyKey: `test-${randomUUID()}`,
      requestHash: HASH,
      captureAuthorizationId: authorizationId,
      ...(spend === "COMPLETED" ? { paypalCaptureId: captureId, paidAt: now } : {}),
    })
    .returning();
  return { ownerId, holdId: hold!.id, spendId: row!.id, authorizationId, captureId };
}

const event = (type: string, resource: object) => ({ id: `WH-TEST-${randomUUID()}`, event_type: type, resource });
const usd = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });
const spendOf = async (id: string) => (await db.select().from(spendRequests).where(eq(spendRequests.id, id)))[0]!;
const holdOf = async (id: string) => (await db.select().from(holds).where(eq(holds.id, id)))[0]!;
const flags = async (ownerId: string) =>
  (await db.select().from(activityEvents).where(and(eq(activityEvents.ownerId, ownerId), eq(activityEvents.type, "PAYMENT_NEEDS_REVIEW")))).length;

describe("PayPal webhook events", () => {
  after(async () => {
    await (db.$client as { end: () => Promise<void> }).end();
  });

  it("ignores events that are not ours (shared PayPal app)", async () => {
    const r1 = await processPayPalEvent(event("PAYMENT.CAPTURE.COMPLETED", { id: "CAPNOTOURS000001", invoice_id: randomUUID(), amount: usd(TOTAL) }));
    assert.equal(r1.outcome, "not_ours");
    const r2 = await processPayPalEvent(event("PAYMENT.CAPTURE.COMPLETED", { id: "CAPNOTOURS000002", invoice_id: "proven-donation-123", amount: usd(TOTAL) }));
    assert.equal(r2.outcome, "not_ours");
    const r3 = await processPayPalEvent(event("PAYMENT.AUTHORIZATION.VOIDED", { id: "AUTHNOTOURS00001" }));
    assert.equal(r3.outcome, "not_ours");
    const r4 = await processPayPalEvent(event("CHECKOUT.ORDER.APPROVED", { id: "ORDERNOTOURS0001" }));
    assert.equal(r4.outcome, "not_ours");
  });

  it("settles a payment PayPal confirms, once", async () => {
    const f = await fixture("PROCESSING");
    const e = event("PAYMENT.CAPTURE.COMPLETED", { id: f.captureId, invoice_id: f.spendId, amount: usd(TOTAL) });
    const first = await processPayPalEvent(e);
    assert.equal(first.outcome, "settled_paid");
    const spend = await spendOf(f.spendId);
    assert.equal(spend.status, "COMPLETED");
    assert.equal(spend.paypalCaptureId, f.captureId);
    const hold = await holdOf(f.holdId);
    assert.equal(hold.reservedCents, 0);
    assert.equal(hold.capturedCents, TOTAL);

    const again = await processPayPalEvent(e);
    assert.equal(again.duplicate, true);
    assert.equal((await holdOf(f.holdId)).capturedCents, TOTAL);
  });

  it("handles two copies of one event arriving together once", async () => {
    const f = await fixture("PROCESSING");
    const e = event("PAYMENT.CAPTURE.COMPLETED", { id: f.captureId, invoice_id: f.spendId, amount: usd(TOTAL) });
    const results = await Promise.all([processPayPalEvent(e), processPayPalEvent(e)]);
    assert.deepEqual(results.map((r) => r.duplicate).sort(), [false, true]);
    assert.equal((await holdOf(f.holdId)).capturedCents, TOTAL);
  });

  it("does not settle when PayPal's amount differs, and flags it for the owner", async () => {
    const f = await fixture("PROCESSING");
    const r = await processPayPalEvent(event("PAYMENT.CAPTURE.COMPLETED", { id: f.captureId, invoice_id: f.spendId, amount: usd(TOTAL + 1) }));
    assert.equal(r.outcome, "flagged_amount_mismatch");
    assert.equal((await spendOf(f.spendId)).status, "PROCESSING");
    assert.equal(await flags(f.ownerId), 1);
  });

  it("flags a payment PayPal completed that Cosign recorded as failed", async () => {
    const f = await fixture("PROCESSING");
    await db.update(spendRequests).set({ status: "PAYMENT_FAILED" }).where(eq(spendRequests.id, f.spendId));
    const r = await processPayPalEvent(event("PAYMENT.CAPTURE.COMPLETED", { id: f.captureId, invoice_id: f.spendId, amount: usd(TOTAL) }));
    assert.equal(r.outcome, "flagged_payment_failed");
    assert.equal((await spendOf(f.spendId)).status, "PAYMENT_FAILED");
    assert.equal(await flags(f.ownerId), 1);
  });

  it("ignores a capture from an authorization that is not this hold's", async () => {
    const f = await fixture("PROCESSING");
    const r = await processPayPalEvent(
      event("PAYMENT.CAPTURE.COMPLETED", { id: f.captureId, invoice_id: f.spendId, amount: usd(TOTAL), links: [{ rel: "up", href: "https://api.sandbox.paypal.com/v2/payments/authorizations/OTHERAUTH0000001" }] }),
    );
    assert.equal(r.outcome, "not_ours");
    assert.equal((await spendOf(f.spendId)).status, "PROCESSING");
  });

  it("reverses a payment PayPal later denies, and gives the amount back to the hold", async () => {
    const f = await fixture("COMPLETED");
    const r = await processPayPalEvent(event("PAYMENT.CAPTURE.DENIED", { id: f.captureId, invoice_id: f.spendId }));
    assert.equal(r.outcome, "reversed");
    assert.equal((await spendOf(f.spendId)).status, "PAYMENT_FAILED");
    assert.equal((await holdOf(f.holdId)).capturedCents, 0);
    const again = await processPayPalEvent(event("PAYMENT.CAPTURE.DENIED", { id: f.captureId, invoice_id: f.spendId }));
    assert.equal(again.outcome, "ignored_payment_failed");
    assert.equal((await holdOf(f.holdId)).capturedCents, 0);
  });

  it("fails a waiting payment PayPal denies and releases its reservation", async () => {
    const f = await fixture("PROCESSING");
    const r = await processPayPalEvent(event("PAYMENT.CAPTURE.DENIED", { id: f.captureId, invoice_id: f.spendId }));
    assert.equal(r.outcome, "settled_failed");
    assert.equal((await spendOf(f.spendId)).status, "PAYMENT_FAILED");
    assert.equal((await holdOf(f.holdId)).reservedCents, 0);
  });

  it("records a store refund for the owner without changing the hold", async () => {
    const f = await fixture("COMPLETED");
    const r = await processPayPalEvent(
      event("PAYMENT.CAPTURE.REFUNDED", { id: "REFUND0000000001", amount: usd(1000), links: [{ rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${f.captureId}` }] }),
    );
    assert.equal(r.outcome, "noted_refund");
    const [logged] = await db.select().from(activityEvents).where(and(eq(activityEvents.ownerId, f.ownerId), eq(activityEvents.type, "PAYMENT_REFUNDED")));
    assert.equal(logged?.amountCents, 1000);
    assert.equal((await holdOf(f.holdId)).capturedCents, TOTAL);
  });

  it("releases an approved renewal hold PayPal voided, but not a past period's", async () => {
    const f = await fixture("COMPLETED");
    await db.update(holds).set({ periodIndex: 1 }).where(eq(holds.id, f.holdId));
    const r = await processPayPalEvent(event("PAYMENT.AUTHORIZATION.VOIDED", { id: f.authorizationId }));
    assert.equal(r.outcome, "hold_released");
    const g = await fixture("COMPLETED");
    const [hold] = await db.select({ slipId: holds.slipId }).from(holds).where(eq(holds.id, g.holdId));
    await db.update(slips).set({ currentPeriodIndex: 1 }).where(eq(slips.id, hold!.slipId));
    const own = await processPayPalEvent(event("PAYMENT.AUTHORIZATION.VOIDED", { id: g.authorizationId }));
    assert.equal(own.outcome, "own_release");
    assert.equal((await holdOf(g.holdId)).status, "ACTIVE");
  });

  it("stops using a hold PayPal voided outside Cosign", async () => {
    const f = await fixture("COMPLETED");
    const r = await processPayPalEvent(event("PAYMENT.AUTHORIZATION.VOIDED", { id: f.authorizationId }));
    assert.equal(r.outcome, "hold_released");
    assert.equal((await holdOf(f.holdId)).status, "RELEASED");
  });
});
