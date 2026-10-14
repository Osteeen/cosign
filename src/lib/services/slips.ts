// Permission slips and their budget holds.
// Create: rules are validated, the budget is split across stores, and one hold
// per store is opened at PayPal for the owner to approve. Return: after the
// owner approves at PayPal, the hold is checked against what we asked for and
// placed. End: the slip stops and every hold is released.

import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { addresses, agents, holds, slips, slipStores, stores } from "@/db/schema";
import { authorizeOrder, createHoldOrder, getOrder, releaseHold } from "@/lib/paypal/holds";
import { PayPalError } from "@/lib/paypal/client";
import type { Category } from "@/lib/rules/types";
import { addDays, appUrl, logActivity, notFound, ServiceError, type Tx } from "./common";
import { shipToOf } from "./addresses";
import { denyPendingApprovals, releaseHoldsAtPayPal } from "./agents";

export const CATEGORIES = [
  "office_supplies",
  "groceries",
  "food_and_drink",
  "travel",
  "software",
  "electronics",
  "household",
  "other",
] as const satisfies readonly Category[];

export const HONOR_PERIOD_DAYS = 3;

export const SlipInput = z
  .object({
    periodDays: z.int().min(1).max(28),
    periodBudgetCents: z.int().min(100).max(1_000_000),
    perPurchaseMaxCents: z.int().min(1).max(1_000_000),
    approveAboveCents: z.int().min(0).max(1_000_000),
    storeIds: z.array(z.uuid()).min(1).max(10),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    expiresAt: z.date().nullable(),
    sourceText: z.string().trim().min(3).max(1000),
    // Each store's share; omitted means an even split.
    allocations: z.record(z.uuid(), z.int().min(100)).nullable(),
    // Where purchases ship (one of the owner's addresses); null = no address.
    shipToAddressId: z.uuid().nullable().optional(),
  })
  .refine((s) => new Set(s.storeIds).size === s.storeIds.length, { message: "A store is listed twice." })
  .refine((s) => s.perPurchaseMaxCents <= s.periodBudgetCents, { message: "The per-purchase limit cannot be more than the budget." });
export type SlipInput = z.infer<typeof SlipInput>;

// Even split; leftover cents go to the first stores.
export function evenSplit(totalCents: number, storeIds: string[]): Map<string, number> {
  const base = Math.floor(totalCents / storeIds.length);
  const extra = totalCents - base * storeIds.length;
  return new Map(storeIds.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
}

export async function getLiveSlip(ownerId: string, agentId: string) {
  const [slip] = await db
    .select()
    .from(slips)
    .where(and(eq(slips.ownerId, ownerId), eq(slips.agentId, agentId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
  return slip ?? null;
}

export async function listSlipHolds(ownerId: string, slipId: string) {
  return db
    .select({
      id: holds.id,
      status: holds.status,
      amountCents: holds.amountCents,
      capturedCents: holds.capturedCents,
      reservedCents: holds.reservedCents,
      paypalOrderId: holds.paypalOrderId,
      expiresAt: holds.expiresAt,
      periodIndex: holds.periodIndex,
      storeId: stores.id,
      storeName: stores.name,
    })
    .from(holds)
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .where(and(eq(holds.ownerId, ownerId), eq(holds.slipId, slipId)))
    .orderBy(desc(holds.periodIndex), asc(stores.name));
}

// PayPal's hosted approval page for an order.
export const approvalUrl = (orderId: string) => `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(orderId)}`;

export async function createSlip(ownerId: string, agentId: string, raw: SlipInput) {
  const input = SlipInput.parse(raw);
  const now = new Date();
  if (input.expiresAt && input.expiresAt <= now) throw new ServiceError(422, "expires_in_past", "The end date must be in the future.");

  const split = input.allocations ? new Map(Object.entries(input.allocations)) : evenSplit(input.periodBudgetCents, input.storeIds);
  if (split.size !== input.storeIds.length || input.storeIds.some((id) => !split.has(id))) {
    throw new ServiceError(422, "bad_allocations", "Give every store an amount.");
  }
  const allocated = [...split.values()].reduce((a, b) => a + b, 0);
  if (allocated > input.periodBudgetCents) {
    throw new ServiceError(422, "over_allocated", "The store amounts add up to more than the budget.");
  }

  const created = await db.transaction(async (tx) => {
    const [agent] = await tx
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.ownerId, ownerId)))
      .for("update");
    if (!agent) throw notFound("Agent");
    if (agent.status === "REVOKED") throw new ServiceError(409, "agent_revoked", "This agent is revoked.");

    const [live] = await tx
      .select({ id: slips.id })
      .from(slips)
      .where(and(eq(slips.agentId, agentId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
    if (live) throw new ServiceError(409, "slip_exists", "End this agent's current slip before giving it a new one.");

    const known = await tx.select({ id: stores.id }).from(stores).where(inArray(stores.id, input.storeIds));
    if (known.length !== input.storeIds.length) throw new ServiceError(422, "unknown_store", "One of the stores is not available.");
    if (input.shipToAddressId) await assertOwnAddress(tx, ownerId, input.shipToAddressId);

    const [slip] = await tx
      .insert(slips)
      .values({
        ownerId,
        agentId,
        status: "AWAITING_HOLDS",
        periodDays: input.periodDays,
        periodBudgetCents: input.periodBudgetCents,
        perPurchaseMaxCents: input.perPurchaseMaxCents,
        approveAboveCents: input.approveAboveCents,
        categories: input.categories,
        expiresAt: input.expiresAt,
        sourceText: input.sourceText,
        shipToAddressId: input.shipToAddressId ?? null,
        currentPeriodStartsAt: now,
        currentPeriodEndsAt: addDays(now, input.periodDays),
      })
      .returning();
    if (!slip) throw new Error("slip insert failed");

    await tx.insert(slipStores).values(input.storeIds.map((storeId) => ({ slipId: slip.id, storeId, allocationCents: split.get(storeId)! })));
    const newHolds = await tx
      .insert(holds)
      .values(input.storeIds.map((storeId) => ({ ownerId, slipId: slip.id, storeId, periodIndex: 0, amountCents: split.get(storeId)! })))
      .returning();
    await logActivity(tx, { ownerId, agentId, type: "SLIP_CREATED", summary: `Co-signed a permission slip for "${agent.name}"` });
    return { slip, newHolds };
  });

  await openHoldsAtPayPal(ownerId, agentId, created.newHolds);
  return created.slip;
}

async function assertOwnAddress(tx: Tx, ownerId: string, addressId: string) {
  const [address] = await tx
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.ownerId, ownerId), isNull(addresses.archivedAt)))
    // Held until the slip is saved, so a removal can't happen in between.
    .for("share");
  if (!address) throw new ServiceError(422, "unknown_address", "Choose one of your saved addresses.");
}

// Changes where a live slip's purchases ship. Orders already sent keep their
// copy; budget holds already at PayPal keep the address they were opened with.
export async function setSlipShipTo(ownerId: string, slipId: string, addressId: string | null) {
  if (!z.uuid().safeParse(slipId).success) throw notFound("Permission slip");
  if (addressId !== null && !z.uuid().safeParse(addressId).success) throw new ServiceError(422, "unknown_address", "Choose one of your saved addresses.");
  return db.transaction(async (tx) => {
    if (addressId) await assertOwnAddress(tx, ownerId, addressId);
    const [updated] = await tx
      .update(slips)
      .set({ shipToAddressId: addressId })
      .where(and(eq(slips.id, slipId), eq(slips.ownerId, ownerId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])))
      .returning({ agentId: slips.agentId });
    if (!updated) throw notFound("Permission slip");
    return updated;
  });
}

// Opens one PayPal order per hold (outside any DB transaction). The slip's
// ship-to address goes on each hold, so the store sees it in PayPal.
async function openHoldsAtPayPal(ownerId: string, agentId: string, newHolds: (typeof holds.$inferSelect)[]) {
  if (newHolds.length === 0) return;
  const [slipRow] = await db.select({ shipTo: slips.shipToAddressId }).from(slips).where(and(eq(slips.id, newHolds[0]!.slipId), eq(slips.ownerId, ownerId)));
  const [address] = slipRow?.shipTo ? await db.select().from(addresses).where(and(eq(addresses.id, slipRow.shipTo), eq(addresses.ownerId, ownerId))) : [];
  const shipTo = address ? shipToOf(address) : null;
  const merchantRows = await db
    .select({ id: stores.id, merchantId: stores.paypalMerchantId })
    .from(stores)
    .where(inArray(stores.id, newHolds.map((h) => h.storeId)));
  const merchants = new Map(merchantRows.map((r) => [r.id, r.merchantId]));
  for (const hold of newHolds) {
    try {
      const { orderId } = await createHoldOrder({
        holdId: hold.id,
        storeMerchantId: merchants.get(hold.storeId)!,
        amountCents: hold.amountCents,
        returnUrl: `${appUrl()}/api/paypal/hold-return`,
        cancelUrl: `${appUrl()}/agents/${agentId}/holds?notice=hold-cancelled`,
        shipTo,
      });
      await db.update(holds).set({ paypalOrderId: orderId }).where(and(eq(holds.id, hold.id), eq(holds.ownerId, ownerId)));
    } catch (e) {
      await db.update(holds).set({ status: "FAILED" }).where(and(eq(holds.id, hold.id), eq(holds.ownerId, ownerId)));
      await logActivity(db, {
        ownerId,
        agentId,
        type: "HOLD_FAILED",
        summary: "PayPal could not open a budget hold",
        data: { holdId: hold.id, issue: e instanceof PayPalError ? e.issue : "error" },
      });
    }
  }
}

// Opens again the holds of a slip that never reached PayPal (FAILED with no
// PayPal order), while the slip still waits for its holds. Holds that reached
// PayPal are never touched. Returns how many were retried.
export async function reopenFailedHolds(ownerId: string, slipId: string): Promise<number> {
  const [slip] = await db
    .select({ agentId: slips.agentId })
    .from(slips)
    .where(and(eq(slips.id, slipId), eq(slips.ownerId, ownerId), eq(slips.status, "AWAITING_HOLDS")));
  if (!slip) throw notFound("Permission slip");
  const retry = await db
    .update(holds)
    .set({ status: "AWAITING_APPROVAL" })
    .where(and(eq(holds.slipId, slipId), eq(holds.ownerId, ownerId), eq(holds.status, "FAILED"), isNull(holds.paypalOrderId)))
    .returning();
  await openHoldsAtPayPal(ownerId, slip.agentId, retry);
  return retry.length;
}

// Daily: holds still waiting in Cosign an hour after they were opened. If the
// owner approved at PayPal but neither their return nor PayPal's webhook got
// through (or an answer was lost), place the hold now; if its slip closed in
// the meantime, completeHoldApproval releases it at PayPal. Never leaves money
// held at PayPal without a record here.
export async function recoverWaitingHolds(now = new Date()): Promise<number> {
  const waiting = await db
    .select({ id: holds.id, ownerId: holds.ownerId, orderId: holds.paypalOrderId })
    .from(holds)
    .where(and(eq(holds.status, "AWAITING_APPROVAL"), isNotNull(holds.paypalOrderId), lt(holds.createdAt, new Date(now.getTime() - 3_600_000)), gt(holds.createdAt, addDays(now, -29))))
    .limit(50);
  let recovered = 0;
  for (const h of waiting) {
    try {
      const order = await getOrder(h.orderId!);
      // Not approved by the owner yet: nothing is held, nothing to do.
      if (order.status !== "APPROVED" && order.status !== "COMPLETED") continue;
      await completeHoldApproval(h.ownerId, h.orderId!);
      recovered++;
    } catch (e) {
      if (!(e instanceof ServiceError)) console.error(`[holds] could not recover hold ${h.id} (${e instanceof PayPalError ? `${e.status} ${e.issue ?? ""}` : e instanceof Error ? e.name : "error"})`);
    }
  }

  // Holds closed recently before Cosign knew of an authorization: if PayPal
  // did place one (its answer was lost), release it so no money stays held.
  const closed = await db
    .select({ hold: holds, merchantId: stores.paypalMerchantId, agentId: slips.agentId })
    .from(holds)
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .where(
      and(
        inArray(holds.status, ["RELEASED", "EXPIRED"]),
        isNull(holds.paypalAuthorizationId),
        isNotNull(holds.paypalOrderId),
        gt(holds.releasedAt, addDays(now, -2)),
      ),
    )
    .limit(50);
  for (const c of closed) {
    try {
      const order = await getOrder(c.hold.paypalOrderId!);
      if (order.status !== "COMPLETED" || !order.placed) continue;
      // Keep the record, then release it at PayPal.
      await db.update(holds).set({ paypalAuthorizationId: order.placed.authorizationId }).where(and(eq(holds.id, c.hold.id), isNull(holds.paypalAuthorizationId)));
      const voided = (await releaseHold({ authorizationId: order.placed.authorizationId, storeMerchantId: c.merchantId })) === "released";
      await logActivity(db, {
        ownerId: c.hold.ownerId,
        agentId: c.agentId,
        type: voided ? "HOLD_RELEASED" : "HOLD_RELEASE_FAILED",
        summary: voided ? "Released a budget hold PayPal had placed after it was closed" : "A budget hold PayPal placed after it was closed could not be released; it will expire on its own",
        amountCents: order.placed.amountCents,
        data: { holdId: c.hold.id, recovered: true },
      });
      recovered++;
    } catch (e) {
      console.error(`[holds] could not check closed hold ${c.hold.id} (${e instanceof PayPalError ? `${e.status} ${e.issue ?? ""}` : e instanceof Error ? e.name : "error"})`);
    }
  }
  return recovered;
}

// Daily: holds still live at PayPal although nothing may spend from them any
// more (their slip ended or expired, the agent was revoked, or their period
// is over) because an earlier release failed. Try releasing them again.
export async function releaseLeftoverHolds(): Promise<number> {
  const leftovers = await db
    .select({ hold: holds, agentId: slips.agentId, slipStatus: slips.status, currentPeriod: slips.currentPeriodIndex, agentStatus: agents.status })
    .from(holds)
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .innerJoin(agents, eq(agents.id, slips.agentId))
    .where(eq(holds.status, "ACTIVE"))
    .limit(500);
  const stale = leftovers.filter(
    (l) => !["ACTIVE", "AWAITING_HOLDS"].includes(l.slipStatus) || l.agentStatus === "REVOKED" || l.hold.periodIndex < l.currentPeriod,
  );
  let released = 0;
  for (const l of stale) released += await releaseHoldsAtPayPal(l.hold.ownerId, [l.hold], l.agentId);
  return released;
}

// The owner is back from PayPal. Only the signed-in owner's own hold can be
// placed, and only if PayPal shows exactly the store and amount we asked for.
export async function completeHoldApproval(ownerId: string, orderId: string): Promise<{ agentId: string }> {
  const [hold] = await db
    .select({ hold: holds, merchantId: stores.paypalMerchantId, agentId: slips.agentId })
    .from(holds)
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .where(and(eq(holds.paypalOrderId, orderId), eq(holds.ownerId, ownerId)));
  if (!hold) throw notFound("Budget hold");
  if (hold.hold.status === "ACTIVE") return { agentId: hold.agentId };
  if (hold.hold.status !== "AWAITING_APPROVAL") {
    throw new ServiceError(409, "hold_closed", "This budget hold was closed before it was approved. Nothing was held.");
  }

  const order = await getOrder(orderId);
  if (order.status !== "APPROVED" && order.status !== "COMPLETED") {
    throw new ServiceError(409, "not_approved", "PayPal has not approved this hold yet.");
  }
  // COMPLETED: PayPal already placed the hold (an earlier answer may have been
  // lost). Record that authorization as it is; authorizing again could be
  // refused once PayPal forgets the request ID.
  const placed = order.status === "COMPLETED" && order.placed ? order.placed : await authorizeOrder(orderId);
  if (!["CREATED", "PARTIALLY_CAPTURED", "PENDING"].includes(placed.status)) {
    throw new ServiceError(409, "hold_closed", "PayPal says this budget hold is no longer live. Nothing is held.");
  }
  if (placed.payeeMerchantId !== hold.merchantId || placed.amountCents !== hold.hold.amountCents) {
    // Should never happen: refuse to use a hold that differs from what we asked for.
    throw new ServiceError(409, "hold_mismatch", "PayPal returned a different store or amount. The hold was not used.");
  }

  const now = new Date();
  const placedHere = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(holds)
      .set({
        status: "ACTIVE",
        paypalAuthorizationId: placed.authorizationId,
        // PayPal's own times: a hold recovered later keeps its real age.
        authorizedAt: placed.authorizedAt ?? now,
        honorPeriodEndsAt: addDays(placed.authorizedAt ?? now, HONOR_PERIOD_DAYS),
        expiresAt: placed.expiresAt ?? addDays(placed.authorizedAt ?? now, 29),
      })
      .where(and(eq(holds.id, hold.hold.id), eq(holds.ownerId, ownerId), eq(holds.status, "AWAITING_APPROVAL")))
      .returning({ slipId: holds.slipId });
    if (!updated) return false;
    await tx
      .update(slips)
      .set({ status: "ACTIVE" })
      .where(and(eq(slips.id, updated.slipId), eq(slips.ownerId, ownerId), eq(slips.status, "AWAITING_HOLDS")));
    await logActivity(tx, {
      ownerId,
      agentId: hold.agentId,
      type: "HOLD_APPROVED",
      summary: "Approved a budget hold at PayPal",
      amountCents: hold.hold.amountCents,
      data: { holdId: hold.hold.id },
    });
    return true;
  });

  if (!placedHere) {
    // Either a concurrent return placed this same authorization (fine), or the
    // hold was closed (revoke, end, roll-over) while PayPal was authorizing.
    // Then nothing in Cosign points at the new authorization: void it now, or
    // the owner's money would stay held at PayPal with no record here.
    const [now2] = await db.select({ authorizationId: holds.paypalAuthorizationId }).from(holds).where(eq(holds.id, hold.hold.id));
    if (now2?.authorizationId === placed.authorizationId) return { agentId: hold.agentId };
    const voided = (await releaseHold({ authorizationId: placed.authorizationId, storeMerchantId: hold.merchantId })) === "released";
    await logActivity(db, {
      ownerId,
      agentId: hold.agentId,
      type: voided ? "HOLD_RELEASED" : "HOLD_RELEASE_FAILED",
      summary: voided
        ? "Released a budget hold approved after its permission slip had closed"
        : "A budget hold approved after its permission slip closed could not be released; it will expire on its own",
      amountCents: hold.hold.amountCents,
      data: { holdId: hold.hold.id, late: true },
    });
    throw new ServiceError(409, "hold_closed", "This budget hold was closed before it was approved. Nothing was held.");
  }
  return { agentId: hold.agentId };
}

export async function endSlip(ownerId: string, slipId: string) {
  const { agentId, active } = await db.transaction(async (tx) => {
    const [slip] = await tx
      .select()
      .from(slips)
      .where(and(eq(slips.id, slipId), eq(slips.ownerId, ownerId)))
      .for("update");
    if (!slip) throw notFound("Permission slip");
    if (slip.status === "ENDED" || slip.status === "EXPIRED") return { agentId: slip.agentId, active: [] };

    // Lock the agent so no purchase is mid-decision while the slip ends.
    await tx.select({ id: agents.id }).from(agents).where(eq(agents.id, slip.agentId)).for("update");
    await denyPendingApprovals(tx, ownerId, slip.agentId);
    await tx.update(slips).set({ status: "ENDED", endedAt: new Date() }).where(eq(slips.id, slipId));
    const live = await tx
      .select()
      .from(holds)
      .where(and(eq(holds.slipId, slipId), inArray(holds.status, ["AWAITING_APPROVAL", "ACTIVE"])))
      .for("update");
    const unapproved = live.filter((h) => h.status === "AWAITING_APPROVAL").map((h) => h.id);
    if (unapproved.length) await tx.update(holds).set({ status: "RELEASED", releasedAt: new Date() }).where(inArray(holds.id, unapproved));
    await logActivity(tx, { ownerId, agentId: slip.agentId, type: "SLIP_ENDED", summary: "Ended a permission slip" });
    return { agentId: slip.agentId, active: live.filter((h) => h.status === "ACTIVE") };
  });
  await releaseHoldsAtPayPal(ownerId, active, agentId);
  return { agentId };
}

// ------------------------------------------------------------- renewal
//
// A budget period lasts at most 28 days (one PayPal hold lives 29). Before it
// ends, the owner renews: new holds for the next period are opened and
// approved in PayPal, while the current period keeps working. At the period
// end, rollOverIfDue() switches to the new holds and releases the old ones. A
// slip that reaches its period end without renewal expires and its holds are
// released, so nothing stays held on the owner's PayPal.

export const RENEWAL_WINDOW_DAYS = 3;

export function renewalState(slip: typeof slips.$inferSelect, now = new Date()) {
  const due = slip.status === "ACTIVE" && slip.currentPeriodEndsAt.getTime() - now.getTime() <= RENEWAL_WINDOW_DAYS * 86_400_000;
  const lastPeriod = slip.expiresAt !== null && slip.expiresAt <= slip.currentPeriodEndsAt;
  return { due, lastPeriod };
}

export async function renewSlip(ownerId: string, slipId: string): Promise<{ agentId: string }> {
  const created = await db.transaction(async (tx) => {
    const [slip] = await tx
      .select()
      .from(slips)
      .where(and(eq(slips.id, slipId), eq(slips.ownerId, ownerId)))
      .for("update");
    if (!slip) throw notFound("Permission slip");
    if (slip.status !== "ACTIVE") throw new ServiceError(409, "slip_not_active", "Only an active slip can be renewed.");
    if (renewalState(slip).lastPeriod) throw new ServiceError(409, "slip_ends", "This slip ends with the current period, so there is nothing to renew.");
    // A hold lasts 29 days from approval: renewing earlier would leave the next
    // period without a usable hold before it ends.
    if (!renewalState(slip).due) throw new ServiceError(409, "renewal_not_due", `You can renew in the last ${RENEWAL_WINDOW_DAYS} days of the period.`);

    const nextIndex = slip.currentPeriodIndex + 1;
    const existing = await tx
      .select({ id: holds.id })
      .from(holds)
      .where(and(eq(holds.slipId, slipId), eq(holds.periodIndex, nextIndex), inArray(holds.status, ["AWAITING_APPROVAL", "ACTIVE"])));
    if (existing.length > 0) return { agentId: slip.agentId, newHolds: [] }; // already started

    const shares = await tx.select().from(slipStores).where(eq(slipStores.slipId, slipId));
    const newHolds = await tx
      .insert(holds)
      .values(shares.map((s) => ({ ownerId, slipId, storeId: s.storeId, periodIndex: nextIndex, amountCents: s.allocationCents })))
      .returning();
    await logActivity(tx, { ownerId, agentId: slip.agentId, type: "SLIP_RENEWAL_STARTED", summary: "Started renewing a budget for the next period" });
    return { agentId: slip.agentId, newHolds };
  });
  if (created.newHolds.length) await openHoldsAtPayPal(ownerId, created.agentId, created.newHolds);
  return { agentId: created.agentId };
}

// Moves a slip whose period has ended onto its renewed holds, or expires it.
// Safe to call often (page loads, agent requests, the daily job).
export async function rollOverIfDue(slipId: string, now = new Date()): Promise<void> {
  const outcome = await db.transaction(async (tx) => {
    const [slip] = await tx.select().from(slips).where(eq(slips.id, slipId)).for("update");
    if (!slip || slip.status !== "ACTIVE") return null;
    const ended = now >= slip.currentPeriodEndsAt;
    const slipOver = slip.expiresAt !== null && now >= slip.expiresAt;
    if (!ended && !slipOver) return null;

    // Lock the agent so no purchase is mid-decision during the switch.
    await tx.select({ id: agents.id }).from(agents).where(eq(agents.id, slip.agentId)).for("update");
    const all = await tx.select().from(holds).where(eq(holds.slipId, slipId)).for("update");
    const current = all.filter((h) => h.periodIndex === slip.currentPeriodIndex && ["AWAITING_APPROVAL", "ACTIVE"].includes(h.status));
    const next = all.filter((h) => h.periodIndex === slip.currentPeriodIndex + 1 && ["AWAITING_APPROVAL", "ACTIVE"].includes(h.status));
    const renewed = !slipOver && next.some((h) => h.status === "ACTIVE");

    await denyPendingApprovals(tx, slip.ownerId, slip.agentId);
    const toVoid = renewed ? current : [...current, ...next];
    const unapproved = toVoid.filter((h) => h.status === "AWAITING_APPROVAL").map((h) => h.id);
    if (unapproved.length) await tx.update(holds).set({ status: "RELEASED", releasedAt: now }).where(inArray(holds.id, unapproved));

    if (renewed) {
      const starts = slip.currentPeriodEndsAt;
      // The period never outlives its PayPal holds (29 days from approval):
      // end it an hour before the first one lapses, if that comes sooner.
      const lapses = next.filter((h) => h.status === "ACTIVE" && h.expiresAt).map((h) => h.expiresAt!.getTime() - 3_600_000);
      const full = addDays(starts, slip.periodDays);
      const ends = new Date(Math.min(full.getTime(), ...lapses));
      await tx
        .update(slips)
        .set({ currentPeriodIndex: slip.currentPeriodIndex + 1, currentPeriodStartsAt: starts, currentPeriodEndsAt: ends > starts ? ends : full })
        .where(eq(slips.id, slipId));
      await logActivity(tx, { ownerId: slip.ownerId, agentId: slip.agentId, type: "SLIP_RENEWED", summary: "A new budget period started" });
    } else {
      await tx.update(slips).set({ status: "EXPIRED", endedAt: now }).where(eq(slips.id, slipId));
      await logActivity(tx, {
        ownerId: slip.ownerId,
        agentId: slip.agentId,
        type: "SLIP_EXPIRED",
        summary: slipOver ? "The permission slip reached its end date" : "The budget period ended without renewal, so the slip stopped",
      });
    }
    return { ownerId: slip.ownerId, agentId: slip.agentId, active: toVoid.filter((h) => h.status === "ACTIVE") };
  });
  if (outcome) await releaseHoldsAtPayPal(outcome.ownerId, outcome.active, outcome.agentId);
}

export async function rollOverAgentIfDue(agentId: string): Promise<void> {
  const [slip] = await db
    .select({ id: slips.id, endsAt: slips.currentPeriodEndsAt, expiresAt: slips.expiresAt })
    .from(slips)
    .where(and(eq(slips.agentId, agentId), eq(slips.status, "ACTIVE")));
  if (!slip) return;
  const now = new Date();
  if (now >= slip.endsAt || (slip.expiresAt && now >= slip.expiresAt)) await rollOverIfDue(slip.id, now);
}

// Holds to show in the guided approval flow: the next period's while a
// renewal is in progress, otherwise the current period's.
export async function holdsToApprove(ownerId: string, slip: typeof slips.$inferSelect) {
  const all = (await listSlipHolds(ownerId, slip.id)).filter((h) => h.status !== "RELEASED");
  const renewing = all.filter((h) => h.periodIndex === slip.currentPeriodIndex + 1);
  if (renewing.length > 0) return { renewal: true, holds: renewing };
  return { renewal: false, holds: all.filter((h) => h.periodIndex === slip.currentPeriodIndex) };
}
