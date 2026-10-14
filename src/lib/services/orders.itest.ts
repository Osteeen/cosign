// Integration tests for order handoff: a paid purchase creates one order with a
// copy of the slip's address; stores open it only with the signed link; the
// agent sees only the address label; one owner can never use another's
// address. Runs against the cosign_test database (pnpm test:db); no PayPal.

import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, agents, holds, orders, slipStores, slips, spendRequests, stores, users } from "@/db/schema";
import { archiveAddress, createAddress, updateAddress } from "./addresses";
import { ServiceError } from "./common";
import { confirmOrder, markOrderShipped, openOrderAsStore, orderToken, ordersForPurchases } from "./orders";
import { setSlipShipTo } from "./slips";
import { toApi } from "./spend";
import { processPayPalEvent } from "./webhooks";

const TOTAL = 1899;
const HOME = { label: "Office", recipient: "Ada Lovelace", line1: "1 Test Street", line2: "Suite 9", city: "Springfield", region: "IL", postal_code: "62701" };

async function fixture() {
  const ownerId = `test-owner-${randomUUID()}`;
  await db.insert(users).values({ id: ownerId, email: `${ownerId}@example.com` });
  const address = await createAddress(ownerId, HOME);
  const [store] = await db
    .insert(stores)
    .values({ name: "Test Store", categories: ["groceries"], paypalMerchantId: `TEST${randomUUID().slice(0, 8)}`, paypalTrackingId: `test-${randomUUID()}`, paymentsReceivable: true })
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
      categories: ["groceries"],
      sourceText: "Test slip",
      shipToAddressId: address.id,
      currentPeriodStartsAt: now,
      currentPeriodEndsAt: new Date(now.getTime() + 28 * 86_400_000),
    })
    .returning();
  await db.insert(slipStores).values({ slipId: slip!.id, storeId: store!.id, allocationCents: 10000 });
  const authorizationId = `AUTH${randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;
  const [hold] = await db
    .insert(holds)
    .values({ ownerId, slipId: slip!.id, storeId: store!.id, periodIndex: 0, status: "ACTIVE", amountCents: 10000, paypalAuthorizationId: authorizationId, reservedCents: TOTAL })
    .returning();
  const [spend] = await db
    .insert(spendRequests)
    .values({
      ownerId,
      agentId: agent!.id,
      slipId: slip!.id,
      storeId: store!.id,
      holdId: hold!.id,
      items: [{ name: "Coffee", category: "groceries", quantity: 1, unit_amount_cents: TOTAL }],
      totalCents: TOTAL,
      currency: "USD",
      purpose: "Test purchase",
      cartHash: "c".repeat(64),
      status: "PROCESSING",
      decision: { outcome: "ALLOW", reasons: [], rule_version: 1, intent_check: null },
      idempotencyKey: `test-${randomUUID()}`,
      requestHash: "c".repeat(64),
      captureAuthorizationId: authorizationId,
    })
    .returning();
  return { ownerId, agentId: agent!.id, slipId: slip!.id, addressId: address.id, spendId: spend!.id, captureId: `CAP${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}` };
}

const pay = (f: Awaited<ReturnType<typeof fixture>>) =>
  processPayPalEvent({ id: `WH-TEST-${randomUUID()}`, event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: f.captureId, invoice_id: f.spendId, amount: { currency_code: "USD", value: (TOTAL / 100).toFixed(2) } } });
const orderOf = async (spendId: string) => (await db.select().from(orders).where(eq(orders.spendRequestId, spendId)))[0];
const rejects = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: unknown) => e instanceof ServiceError && e.code === code);

describe("order handoff", () => {
  after(async () => {
    await (db.$client as { end: () => Promise<void> }).end();
  });

  it("a paid purchase creates one order with a copy of the address", async () => {
    const f = await fixture();
    assert.equal((await pay(f)).outcome, "settled_paid");
    const order = await orderOf(f.spendId);
    assert.ok(order);
    assert.equal(order.totalCents, TOTAL);
    assert.deepEqual(order.shipTo, { label: "Office", recipient: "Ada Lovelace", line1: "1 Test Street", line2: "Suite 9", city: "Springfield", region: "IL", postal_code: "62701", country_code: "US" });

    // Editing the address later changes future orders only.
    await updateAddress(f.ownerId, f.addressId, { ...HOME, line1: "2 Other Road" });
    assert.equal(((await orderOf(f.spendId))!.shipTo as { line1: string }).line1, "1 Test Street");
  });

  it("the agent sees only the address label", async () => {
    const f = await fixture();
    await pay(f);
    const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, f.spendId));
    const out = toApi(row!, (await ordersForPurchases(f.ownerId, [f.spendId])).get(f.spendId));
    assert.deepEqual(out.order, { status: "SENT", ships_to: "Office" });
    assert.ok(!JSON.stringify(out).includes("Test Street"));
  });

  it("the store opens it only with the signed link; opening changes nothing; it can confirm and ship", async () => {
    const f = await fixture();
    await pay(f);
    const order = (await orderOf(f.spendId))!;
    await assert.rejects(openOrderAsStore(order.id, "wrong-token"), (e: unknown) => e instanceof ServiceError && e.status === 404);
    await assert.rejects(openOrderAsStore(order.id, ""), (e: unknown) => e instanceof ServiceError && e.status === 404);
    // Link previews and scanners open links too: opening is read-only.
    assert.equal((await openOrderAsStore(order.id, orderToken(order.id))).order.status, "SENT");
    assert.equal((await orderOf(f.spendId))!.status, "SENT");
    await assert.rejects(markOrderShipped(order.id, orderToken(randomUUID())), (e: unknown) => e instanceof ServiceError && e.status === 404);
    assert.equal((await confirmOrder(order.id, orderToken(order.id))).status, "SEEN");
    assert.equal((await markOrderShipped(order.id, orderToken(order.id))).status, "SHIPPED");
    const [logged] = await db.select().from(activityEvents).where(and(eq(activityEvents.ownerId, f.ownerId), eq(activityEvents.type, "ORDER_SHIPPED")));
    assert.ok(logged);
  });

  it("a pending payment can't ship until PayPal confirms it", async () => {
    const f = await fixture();
    await pay(f);
    const order = (await orderOf(f.spendId))!;
    await db.update(orders).set({ paymentPending: true }).where(eq(orders.id, order.id));
    await rejects(markOrderShipped(order.id, orderToken(order.id)), "payment_pending");
    assert.equal((await pay(f)).outcome, "payment_confirmed");
    assert.equal((await markOrderShipped(order.id, orderToken(order.id))).status, "SHIPPED");
  });

  it("a payment PayPal reverses cancels its order", async () => {
    const f = await fixture();
    await pay(f);
    await processPayPalEvent({ id: `WH-TEST-${randomUUID()}`, event_type: "PAYMENT.CAPTURE.DENIED", resource: { id: f.captureId, invoice_id: f.spendId } });
    assert.equal((await orderOf(f.spendId))!.status, "CANCELLED");
    const order = (await orderOf(f.spendId))!;
    assert.equal((await markOrderShipped(order.id, orderToken(order.id))).status, "CANCELLED");
  });

  it("a reversal after the store shipped is flagged for the owner", async () => {
    const f = await fixture();
    await pay(f);
    const order = (await orderOf(f.spendId))!;
    await markOrderShipped(order.id, orderToken(order.id));
    const r = await processPayPalEvent({ id: `WH-TEST-${randomUUID()}`, event_type: "PAYMENT.CAPTURE.DENIED", resource: { id: f.captureId, invoice_id: f.spendId } });
    assert.equal(r.outcome, "reversed_flagged");
    assert.equal((await orderOf(f.spendId))!.status, "SHIPPED");
    const flagged = await db.select().from(activityEvents).where(and(eq(activityEvents.ownerId, f.ownerId), eq(activityEvents.type, "PAYMENT_NEEDS_REVIEW")));
    assert.equal(flagged.length, 1);
  });

  it("a full refund cancels an unshipped order; a partial one does not", async () => {
    const refund = (f: Awaited<ReturnType<typeof fixture>>, cents: number) =>
      processPayPalEvent({
        id: `WH-TEST-${randomUUID()}`,
        event_type: "PAYMENT.CAPTURE.REFUNDED",
        resource: { id: `REF${randomUUID().slice(0, 12).toUpperCase()}`, amount: { currency_code: "USD", value: (cents / 100).toFixed(2) }, links: [{ rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${f.captureId}` }] },
      });
    const partial = await fixture();
    await pay(partial);
    await refund(partial, 100);
    assert.equal((await orderOf(partial.spendId))!.status, "SENT");
    const full = await fixture();
    await pay(full);
    await refund(full, TOTAL);
    assert.equal((await orderOf(full.spendId))!.status, "CANCELLED");
  });

  it("an owner can't ship to another owner's address, or remove one a live slip uses", async () => {
    const mine = await fixture();
    const theirs = await fixture();
    await rejects(setSlipShipTo(mine.ownerId, mine.slipId, theirs.addressId), "unknown_address");
    await assert.rejects(updateAddress(mine.ownerId, theirs.addressId, HOME), (e: unknown) => e instanceof ServiceError && e.status === 404);
    await rejects(archiveAddress(mine.ownerId, mine.addressId), "address_in_use");
    await setSlipShipTo(mine.ownerId, mine.slipId, null);
    await archiveAddress(mine.ownerId, mine.addressId);
  });
});
