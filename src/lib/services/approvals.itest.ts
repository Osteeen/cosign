// Integration tests: an owner's approval can be used once, for exactly the cart
// they saw, by them only, before it expires - and two decisions racing each
// other settle once. Runs against the cosign_test database (pnpm test:db);
// uses only the decline path, so nothing calls PayPal.

import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, approvals, holds, slipStores, slips, spendRequests, stores, users } from "@/db/schema";
import { ServiceError } from "./common";
import { decideApproval } from "./spend";

const HASH = "a".repeat(64);
const TOTAL = 2500;

async function fixture() {
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
      approveAboveCents: 1000,
      categories: ["office_supplies"],
      sourceText: "Test slip",
      currentPeriodStartsAt: now,
      currentPeriodEndsAt: new Date(now.getTime() + 28 * 86_400_000),
    })
    .returning();
  await db.insert(slipStores).values({ slipId: slip!.id, storeId: store!.id, allocationCents: 10000 });
  const [hold] = await db
    .insert(holds)
    .values({ ownerId, slipId: slip!.id, storeId: store!.id, periodIndex: 0, status: "ACTIVE", amountCents: 10000, reservedCents: TOTAL })
    .returning();
  const [spend] = await db
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
      status: "PENDING_APPROVAL",
      decision: { outcome: "NEEDS_APPROVAL", reasons: [], rule_version: 1, intent_check: null },
      idempotencyKey: `test-${randomUUID()}`,
      requestHash: HASH,
      approvalExpiresAt: new Date(now.getTime() + 86_400_000),
    })
    .returning();
  const [approval] = await db
    .insert(approvals)
    .values({ ownerId, spendRequestId: spend!.id, cartHash: HASH, totalCents: TOTAL, expiresAt: new Date(now.getTime() + 86_400_000) })
    .returning();
  return { ownerId, holdId: hold!.id, spendId: spend!.id, approvalId: approval!.id };
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof ServiceError && e.code === code);
}
const seen = { cartHash: HASH, totalCents: TOTAL };
const reserved = async (holdId: string) => (await db.select({ r: holds.reservedCents }).from(holds).where(eq(holds.id, holdId)))[0]!.r;

describe("owner approvals", () => {
  it("cannot be used again once decided", async () => {
    const f = await fixture();
    const denied = await decideApproval(f.ownerId, f.approvalId, "deny", seen);
    assert.equal(denied.status, "DENIED");
    assert.equal(await reserved(f.holdId), 0);
    await rejects(decideApproval(f.ownerId, f.approvalId, "approve", seen), "already_decided");
    await rejects(decideApproval(f.ownerId, f.approvalId, "deny", seen), "already_decided");
    assert.equal(await reserved(f.holdId), 0);
  });

  it("only approves the exact cart the owner saw", async () => {
    const f = await fixture();
    await rejects(decideApproval(f.ownerId, f.approvalId, "approve", { cartHash: "b".repeat(64), totalCents: TOTAL }), "cart_changed");
    await rejects(decideApproval(f.ownerId, f.approvalId, "approve", { cartHash: HASH, totalCents: TOTAL + 1 }), "cart_changed");
    const [a] = await db.select().from(approvals).where(eq(approvals.id, f.approvalId));
    assert.equal(a!.status, "PENDING");
    assert.equal(await reserved(f.holdId), TOTAL);
  });

  it("is invisible to another owner", async () => {
    const f = await fixture();
    const other = await fixture();
    await rejects(decideApproval(other.ownerId, f.approvalId, "deny", seen), "not_found");
    const [a] = await db.select().from(approvals).where(eq(approvals.id, f.approvalId));
    assert.equal(a!.status, "PENDING");
  });

  it("cannot be used after it expires", async () => {
    const f = await fixture();
    await db.update(approvals).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(approvals.id, f.approvalId));
    await rejects(decideApproval(f.ownerId, f.approvalId, "approve", seen), "already_decided");
    const [a] = await db.select().from(approvals).where(eq(approvals.id, f.approvalId));
    assert.equal(a!.status, "EXPIRED");
    assert.equal(await reserved(f.holdId), 0);
  });

  it("settles once when two decisions race", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      decideApproval(f.ownerId, f.approvalId, "deny", seen),
      decideApproval(f.ownerId, f.approvalId, "deny", seen),
      decideApproval(f.ownerId, f.approvalId, "deny", seen),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    for (const r of results) if (r.status === "rejected") assert.ok(r.reason instanceof ServiceError && r.reason.code === "already_decided");
    // Released exactly once: never below zero (the database would refuse it anyway).
    assert.equal(await reserved(f.holdId), 0);
  });
});

after(async () => {
  await (db.$client as { end: () => Promise<void> }).end();
});
