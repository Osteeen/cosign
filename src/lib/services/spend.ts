// Agent purchases.
//
// 1. Idempotency: the same (agent, Idempotency-Key) returns the same result; the
//    same key with a different body is refused.
// 2. Decide inside one transaction that locks the agent row, so two requests
//    from one agent can never spend the same budget. The rules engine decides;
//    the AI intent check may only make that stricter.
// 3. ALLOW reserves the amount on the store's hold, commits, then captures at
//    PayPal with a request ID derived from the spend request (retry-safe), and
//    finally moves the amount from reserved to captured.
// 4. NEEDS_APPROVAL also reserves, so a pending purchase cannot be overspent
//    around; the owner's approval then captures, a denial releases.

import "server-only";
import { after } from "next/server";
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { agents, approvals, holds, slips, slipStores, spendRequests, stores } from "@/db/schema";
import { captureFromHold, capturesOnOrder, COUNTED_CAPTURE } from "@/lib/paypal/holds";
import { authorizationForCapture } from "./reauth";
import { PayPalError } from "@/lib/paypal/client";
import { cartHash } from "@/lib/rules/cart-hash";
import { checkIntent } from "@/lib/ai/intent-check";
import { applyIntentCheck, evaluate } from "@/lib/rules/engine";
import type { Category, FinalDecision, IntentResult, SpendRequestInput } from "@/lib/rules/types";
import { formatUsd } from "@/lib/money";
import { logActivity, notFound, ServiceError, sha256, type Tx } from "./common";
import { notifyApprovalNeeded } from "./notify";
import { isDemoOwner } from "@/lib/demo/account";
import { cancelOrderForPurchase, confirmOrderPayment, createOrderForPaidPurchase } from "./orders";
import { CATEGORIES, rollOverAgentIfDue } from "./slips";

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export const SpendBody = z
  .object({
    store_id: z.uuid(),
    items: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            category: z.enum(CATEGORIES),
            quantity: z.int().min(1).max(1000),
            unit_amount_cents: z.int().min(1).max(10_000_000),
            product_url: z.url().max(2048).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    total: z.object({ amount_cents: z.int().min(1).max(10_000_000), currency: z.literal("USD") }).strict(),
    purpose: z.string().trim().min(3).max(500),
  })
  .strict();
export type SpendBody = z.infer<typeof SpendBody>;

type SpendRow = typeof spendRequests.$inferSelect;

function toEngineRequest(body: SpendBody): SpendRequestInput {
  return {
    storeId: body.store_id,
    items: body.items.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity, unitAmountCents: i.unit_amount_cents })),
    total: { amountCents: body.total.amount_cents, currency: body.total.currency },
  };
}

// Everything the rules engine needs. With lock=true (inside the transaction)
// the agent and the period's holds are row-locked, so the budget can't race.
async function loadContext(q: Tx, agentId: string, storeId: string, lock: boolean) {
  const agentQ = q.select().from(agents).where(eq(agents.id, agentId));
  const [agent] = lock ? await agentQ.for("update") : await agentQ;
  if (!agent) throw new ServiceError(401, "unauthorized", "Unknown agent.");
  const [slip] = await q
    .select()
    .from(slips)
    .where(and(eq(slips.agentId, agentId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
  let hold: typeof holds.$inferSelect | undefined;
  let committedCents = 0;
  let slipStoreIds: string[] = [];
  if (slip) {
    const holdsQ = q.select().from(holds).where(and(eq(holds.slipId, slip.id), eq(holds.periodIndex, slip.currentPeriodIndex)));
    const periodHolds = lock ? await holdsQ.for("update") : await holdsQ;
    committedCents = periodHolds.reduce((sum, h) => sum + h.capturedCents + h.reservedCents, 0);
    // A frozen hold (PayPal disagrees with Cosign) or one PayPal has let lapse can't be spent from.
    const now = new Date();
    hold = periodHolds.find((h) => h.storeId === storeId && h.status === "ACTIVE" && !h.frozenAt && (!h.expiresAt || h.expiresAt > now));
    slipStoreIds = (await q.select({ id: slipStores.storeId }).from(slipStores).where(eq(slipStores.slipId, slip.id))).map((r) => r.id);
  }
  return { agent, slip, hold, committedCents, slipStoreIds };
}

function runRules(ctx: Awaited<ReturnType<typeof loadContext>>, request: SpendRequestInput) {
  const { agent, slip, hold, committedCents, slipStoreIds } = ctx;
  return evaluate({
    agentStatus: agent.status,
    slip: slip
      ? {
          status: slip.status,
          ruleVersion: slip.ruleVersion,
          currentPeriodEndsAt: slip.currentPeriodEndsAt,
          committedThisPeriodCents: committedCents,
          rules: {
            currency: "USD",
            periodDays: slip.periodDays,
            periodBudgetCents: slip.periodBudgetCents,
            perPurchaseMaxCents: slip.perPurchaseMaxCents,
            approveAboveCents: slip.approveAboveCents,
            storeIds: slipStoreIds,
            categories: slip.categories as (typeof CATEGORIES)[number][],
            expiresAt: slip.expiresAt,
          },
        }
      : null,
    hold: hold ? { status: hold.status, remainingCents: hold.amountCents - hold.capturedCents - hold.reservedCents } : null,
    request,
    now: new Date(),
  });
}

// What the rules alone would decide for buying one item at a store, without
// asking: no locks, no writes, no AI check (which can only make it stricter).
// Used to show agents what they can buy before they try.
export async function previewRules(agentId: string, storeId: string, item: { name: string; category: Category; unitAmountCents: number }) {
  const ctx = await loadContext(db, agentId, storeId, false);
  const decision = runRules(ctx, {
    storeId,
    items: [{ name: item.name, category: item.category, quantity: 1, unitAmountCents: item.unitAmountCents }],
    total: { amountCents: item.unitAmountCents, currency: "USD" },
  });
  return { outcome: decision.outcome, reasons: decision.reasons };
}

export async function createSpendRequest(agentId: string, idempotencyKey: string, body: SpendBody): Promise<{ row: SpendRow; replay: boolean }> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(idempotencyKey)) {
    throw new ServiceError(400, "bad_idempotency_key", "Idempotency-Key must be 16 to 64 letters, digits, - or _.");
  }
  const requestHash = sha256(JSON.stringify(body));

  const existing = await findByKey(agentId, idempotencyKey);
  if (existing) {
    const r = replay(existing, requestHash);
    return { row: await resumeIfStuck(r.row), replay: true };
  }

  // If the budget period just ended, move to the renewed holds (or expire) first.
  await rollOverAgentIfDue(agentId);

  const engineRequest = toEngineRequest(body);
  const hash = cartHash(engineRequest);
  // First look without locks: only a purchase the rules would ALLOW needs the AI
  // check (it can't loosen a DENY or a NEEDS_APPROVAL). The AI call stays outside
  // the transaction so it never holds the agent's lock.
  const preview = await loadContext(db, agentId, body.store_id, false);
  const previewDecision = runRules(preview, engineRequest);
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, body.store_id));
  const intent: IntentResult =
    previewDecision.outcome === "ALLOW" && preview.slip
      ? await checkIntent({
          ownerWords: preview.slip.sourceText,
          categories: preview.slip.categories,
          storeName: store?.name ?? "unknown store",
          items: engineRequest.items.map((i) => ({ ...i })),
          totalCents: engineRequest.total.amountCents,
          purpose: body.purpose,
        })
      : { verdict: "SKIPPED", summary: null };

  let row: SpendRow;
  try {
    row = await db.transaction(async (tx) => {
      // Serialises this agent's purchases: the budget check below cannot race.
      const ctx = await loadContext(tx, agentId, body.store_id, true);
      const { agent, slip } = ctx;
      let hold = ctx.hold;
      const raw = runRules(ctx, engineRequest);
      // Rare race: the first look said no, but now the rules allow it. The AI
      // check never ran, so the owner decides.
      const intentNow: IntentResult =
        raw.outcome === "ALLOW" && intent.verdict === "SKIPPED" && previewDecision.outcome !== "ALLOW"
          ? { verdict: "FLAGGED", summary: "This purchase changed status while it was being checked, so it needs your OK." }
          : intent;
      const decision: FinalDecision = applyIntentCheck(raw, intentNow);

      const total = engineRequest.total.amountCents;
      const status = decision.outcome === "ALLOW" ? "PROCESSING" : decision.outcome === "NEEDS_APPROVAL" ? "PENDING_APPROVAL" : "DENIED";
      const reserves = decision.outcome !== "DENY" && hold;

      if (reserves) {
        await tx
          .update(holds)
          .set({ reservedCents: sql`${holds.reservedCents} + ${total}` })
          .where(eq(holds.id, hold!.id));
      }

      const [inserted] = await tx
        .insert(spendRequests)
        .values({
          ownerId: agent.ownerId,
          agentId,
          slipId: slip?.id ?? null,
          storeId: body.store_id,
          holdId: reserves ? hold!.id : null,
          items: body.items,
          totalCents: total,
          currency: "USD",
          purpose: body.purpose,
          cartHash: hash,
          status,
          decision: {
            outcome: decision.outcome,
            reasons: decision.reasons,
            rule_version: decision.ruleVersion,
            intent_check: decision.intentCheck,
          },
          idempotencyKey,
          requestHash,
          approvalExpiresAt: decision.outcome === "NEEDS_APPROVAL" ? new Date(Date.now() + APPROVAL_TTL_MS) : null,
        })
        .returning();
      if (!inserted) throw new Error("spend insert failed");

      if (decision.outcome === "NEEDS_APPROVAL") {
        await tx.insert(approvals).values({
          ownerId: agent.ownerId,
          spendRequestId: inserted.id,
          cartHash: hash,
          totalCents: total,
          expiresAt: inserted.approvalExpiresAt!,
        });
      }

      const verb = { ALLOW: "SPEND_ALLOWED", NEEDS_APPROVAL: "APPROVAL_REQUESTED", DENY: "SPEND_DENIED" }[decision.outcome];
      const said = { ALLOW: "Allowed", NEEDS_APPROVAL: "Asked you about", DENY: "Blocked" }[decision.outcome];
      await logActivity(tx, {
        ownerId: agent.ownerId,
        agentId,
        spendRequestId: inserted.id,
        type: verb,
        amountCents: total,
        summary: `${said} ${formatUsd(total)} from "${agent.name}"`,
        data: { reasons: decision.reasons.map((r) => r.code) },
      });
      return inserted;
    });
  } catch (e) {
    // Two identical requests raced: the unique (agent, key) index kept one.
    if (isUniqueViolation(e)) {
      const winner = await findByKey(agentId, idempotencyKey);
      if (winner) return replay(winner, requestHash);
    }
    throw e;
  }

  if (row.status === "PROCESSING") row = await capture(row);
  // Email the owner after the agent has its answer, so the agent never waits on email.
  if (row.status === "PENDING_APPROVAL") {
    const id = row.id;
    after(() => notifyApprovalNeeded(id));
  }
  return { row, replay: false };
}

async function findByKey(agentId: string, key: string) {
  const [row] = await db
    .select()
    .from(spendRequests)
    .where(and(eq(spendRequests.agentId, agentId), eq(spendRequests.idempotencyKey, key)));
  return row ?? null;
}

function replay(row: SpendRow, requestHash: string) {
  if (row.requestHash !== requestHash) {
    throw new ServiceError(409, "idempotency_key_reused", "This Idempotency-Key was already used for a different request.");
  }
  return { row, replay: true };
}

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

// Captures a PROCESSING request's reserved amount at PayPal and settles it.
// Captures a PROCESSING request's reserved amount at PayPal and settles it.
// - Definite refusal (PayPal 4xx): release the reservation, mark failed.
// - Unknown outcome (timeout, network, 5xx, 429): retry with the SAME request
//   ID, which PayPal treats as the same capture. If still unknown, keep the
//   reservation and leave it PROCESSING; resumeIfStuck() retries later. The
//   reservation is never released while the money might have moved.
const RETRY_DELAYS_MS = [400, 1200];

const CAPTURE_LEASE_MS = 90_000;

async function capture(input: SpendRow): Promise<SpendRow> {
  // One caller at a time talks to PayPal for a purchase (an agent retry or
  // the daily job can arrive while a first attempt is still waiting).
  const now = new Date();
  const [leased] = await db
    .update(spendRequests)
    .set({ captureLeaseUntil: new Date(now.getTime() + CAPTURE_LEASE_MS) })
    .where(
      and(
        eq(spendRequests.id, input.id),
        eq(spendRequests.status, "PROCESSING"),
        or(isNull(spendRequests.captureLeaseUntil), lt(spendRequests.captureLeaseUntil, now)),
      ),
    )
    .returning();
  if (!leased) {
    const [current] = await db.select().from(spendRequests).where(eq(spendRequests.id, input.id));
    return current ?? input;
  }
  const row = leased;

  // Pin the authorization on the first attempt; every retry reuses it with the
  // same PayPal-Request-Id, so a reauthorization in between cannot double-charge.
  let authorizationId = row.captureAuthorizationId;
  if (!authorizationId) {
    const chosen = await authorizationForCapture(row.holdId!);
    if (!chosen) return settle(row, null, "no_authorization");
    await db
      .update(spendRequests)
      .set({ captureAuthorizationId: chosen })
      .where(and(eq(spendRequests.id, row.id), isNull(spendRequests.captureAuthorizationId)));
    const [pinned] = await db.select({ id: spendRequests.captureAuthorizationId }).from(spendRequests).where(eq(spendRequests.id, row.id));
    authorizationId = pinned?.id ?? chosen;
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await captureFromHold({ authorizationId, amountCents: row.totalCents, spendRequestId: row.id });
      if (result.status === "COMPLETED" || result.status === "PENDING") return settle(row, result.captureId, null, result.status === "PENDING");
      return failUnlessPaid(row, `capture_${result.status.toLowerCase()}`);
    } catch (e) {
      if (e instanceof PayPalError && e.definite) return failUnlessPaid(row, e.issue ?? `http_${e.status}`);
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) return stillUnconfirmed(row, e instanceof PayPalError ? e.issue : "error");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function stillUnconfirmed(row: SpendRow, issue: string | null): Promise<SpendRow> {
  await logActivity(db, {
    ownerId: row.ownerId,
    agentId: row.agentId,
    spendRequestId: row.id,
    type: "PAYMENT_UNCONFIRMED",
    amountCents: row.totalCents,
    summary: `Waiting for PayPal to confirm ${formatUsd(row.totalCents)}. The amount stays reserved.`,
    data: { issue },
  });
  return row;
}

// PayPal refused this attempt. That alone doesn't prove nothing was paid (an
// earlier attempt's answer may have been lost), so check PayPal's own record
// of the hold's captures before releasing anything. If PayPal can't be asked,
// the amount stays reserved and the purchase stays processing.
async function failUnlessPaid(row: SpendRow, failure: string): Promise<SpendRow> {
  try {
    const [hold] = await db.select({ orderId: holds.paypalOrderId }).from(holds).where(eq(holds.id, row.holdId!));
    const paid = hold?.orderId ? (await capturesOnOrder(hold.orderId)).find((c) => c.invoiceId === row.id && COUNTED_CAPTURE.has(c.status)) : undefined;
    if (paid) return settle(row, paid.id, null, paid.status === "PENDING");
  } catch (e) {
    return stillUnconfirmed(row, e instanceof PayPalError ? e.issue : "error");
  }
  return settle(row, null, failure);
}

// A request left PROCESSING (PayPal did not answer, or the server stopped
// mid-way) is retried with its original request ID. Safe to call any time.
const STUCK_AFTER_MS = 30_000;
export async function resumeIfStuck(row: SpendRow): Promise<SpendRow> {
  if (row.status !== "PROCESSING" || Date.now() - row.createdAt.getTime() < STUCK_AFTER_MS) return row;
  return capture(row);
}

async function settle(row: SpendRow, captureId: string | null, failure: string | null, paymentPending = false): Promise<SpendRow> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(spendRequests).where(eq(spendRequests.id, row.id)).for("update");
    if (!current || current.status !== "PROCESSING") return current ?? row;
    await tx
      .update(holds)
      .set(
        captureId
          ? { reservedCents: sql`${holds.reservedCents} - ${row.totalCents}`, capturedCents: sql`${holds.capturedCents} + ${row.totalCents}` }
          : { reservedCents: sql`${holds.reservedCents} - ${row.totalCents}` },
      )
      .where(eq(holds.id, row.holdId!));
    const [updated] = await tx
      .update(spendRequests)
      .set(captureId ? { status: "COMPLETED", paypalCaptureId: captureId, paidAt: new Date() } : { status: "PAYMENT_FAILED" })
      .where(eq(spendRequests.id, row.id))
      .returning();
    // Paid: hand the order to the store.
    if (captureId) await createOrderForPaidPurchase(tx, updated!, { paymentPending });
    await logActivity(tx, {
      ownerId: row.ownerId,
      agentId: row.agentId,
      spendRequestId: row.id,
      type: captureId ? "PAYMENT_CAPTURED" : "PAYMENT_FAILED",
      amountCents: row.totalCents,
      summary: captureId ? `Paid ${formatUsd(row.totalCents)} to the store` : `PayPal did not take ${formatUsd(row.totalCents)}. Nothing was charged.`,
      data: failure ? { issue: failure } : undefined,
    });
    return updated!;
  });
}

// ------------------------------------------------- PayPal webhook follow-up
// Verified PayPal events about captures. Each one names our spend request in
// invoice_id (set on every capture). All are safe to repeat.

export type WebhookOutcome = string;

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

// PayPal says money moved in a way Cosign did not count. Money states are
// never changed automatically here; the owner sees it under Problems.
async function needsReview(row: SpendRow, summary: string, data: Record<string, unknown>) {
  await logActivity(db, {
    ownerId: row.ownerId,
    agentId: row.agentId,
    spendRequestId: row.id,
    type: "PAYMENT_NEEDS_REVIEW",
    amountCents: row.totalCents,
    summary,
    data,
  });
}

// The store shipped, but the payment did not stand: the owner must sort it
// out with the store. Logged under Problems; nothing changes automatically.
async function orderShippedButUnpaid(tx: Tx, row: SpendRow) {
  await logActivity(tx, {
    ownerId: row.ownerId,
    agentId: row.agentId,
    spendRequestId: row.id,
    type: "PAYMENT_NEEDS_REVIEW",
    amountCents: row.totalCents,
    summary: `The store had already shipped this order when PayPal took back ${formatUsd(row.totalCents)}. Check with the store.`,
  });
}

// PAYMENT.CAPTURE.COMPLETED: settles a request still waiting for PayPal's
// answer (timeout, server stopped) - the money moved, so it is paid. The
// capture must be for this request's amount, from the authorization it was
// sent to; anything else is flagged for the owner, never settled.
export async function captureConfirmedByPayPal(spendId: unknown, captureId: string, amountCents: number | null, authorizationId: string | null): Promise<WebhookOutcome> {
  if (!isUuid(spendId)) return "not_ours";
  const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, spendId));
  if (!row) return "not_ours";
  if (authorizationId && row.captureAuthorizationId && authorizationId !== row.captureAuthorizationId) {
    const [hold] = await db.select({ a: holds.paypalAuthorizationId, c: holds.paypalCurrentAuthorizationId }).from(holds).where(eq(holds.id, row.holdId!));
    // Not from this hold at all: someone else's capture that reused the ID.
    if (authorizationId !== hold?.a && authorizationId !== hold?.c) return "not_ours";
  }
  if (row.status === "COMPLETED") {
    // A capture that was PENDING is now complete: the store may ship.
    if (row.paypalCaptureId === captureId) return (await confirmOrderPayment(row.id)) ? "payment_confirmed" : "already_paid";
    // Money left the hold that Cosign never counted: stop the hold from
    // spending any more until the owner has looked.
    await freezeHold(row.holdId!, `PayPal reports a second payment for a purchase (${amountCents === null ? "amount unknown" : formatUsd(amountCents)}). Spending from this hold is paused until you check with the store.`);
    return "flagged_second_capture";
  }
  if (amountCents !== row.totalCents) {
    await freezeHold(row.holdId!, `PayPal reports ${amountCents === null ? "an unknown amount" : formatUsd(amountCents)} for a ${formatUsd(row.totalCents)} purchase. Spending from this hold is paused until you check with the store.`);
    return "flagged_amount_mismatch";
  }
  if (row.status !== "PROCESSING") {
    // Cosign had recorded it as not paid, but PayPal took the money: count it
    // now, so the budget can't be spent twice.
    return (await correctToPaid(row, captureId, false)) ? `corrected_${row.status.toLowerCase()}` : "flagged_could_not_correct";
  }
  await settle(row, captureId, null);
  return "settled_paid";
}

// PAYMENT.CAPTURE.DENIED / DECLINED: the money did not move. A waiting request
// fails; one we already counted as paid (PayPal said PENDING) is reversed and
// its amount goes back to the hold.
export async function captureFailedAtPayPal(spendId: unknown, captureId: string): Promise<WebhookOutcome> {
  if (!isUuid(spendId)) return "not_ours";
  const [row] = await db.select().from(spendRequests).where(eq(spendRequests.id, spendId));
  if (!row) return "not_ours";
  if (row.status === "PROCESSING") {
    await settle(row, null, "capture_denied");
    return "settled_failed";
  }
  if (row.status !== "COMPLETED" || row.paypalCaptureId !== captureId) return `ignored_${row.status.toLowerCase()}`;
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(spendRequests).where(eq(spendRequests.id, row.id)).for("update");
    if (current?.status !== "COMPLETED") return "already_reversed";
    await tx.update(holds).set({ capturedCents: sql`${holds.capturedCents} - ${row.totalCents}` }).where(eq(holds.id, row.holdId!));
    await tx.update(spendRequests).set({ status: "PAYMENT_FAILED" }).where(eq(spendRequests.id, row.id));
    const order = await cancelOrderForPurchase(tx, row.id);
    await logActivity(tx, {
      ownerId: row.ownerId,
      agentId: row.agentId,
      spendRequestId: row.id,
      type: "PAYMENT_REVERSED",
      amountCents: row.totalCents,
      summary: `PayPal did not complete ${formatUsd(row.totalCents)}. Nothing was charged${order === "cancelled" ? " and the store's order was cancelled" : ""}.`,
    });
    if (order === "shipped") await orderShippedButUnpaid(tx, row);
    return order === "shipped" ? "reversed_flagged" : "reversed";
  });
}

// PAYMENT.CAPTURE.REFUNDED / REVERSED: the store refunded (or PayPal reversed)
// a paid purchase. Recorded for the owner; the hold's spent amount stays, as
// PayPal does not give a refunded amount back to the authorization.
export async function captureRefundedAtPayPal(captureId: string, amountCents: number | null, reversed: boolean): Promise<WebhookOutcome> {
  const [row] = await db.select().from(spendRequests).where(eq(spendRequests.paypalCaptureId, captureId));
  if (!row) return "not_ours";
  // All the money went back (or PayPal took it back): the store won't ship.
  // A partial refund (say, a damaged item) leaves the order as it is.
  if (reversed || amountCents === row.totalCents) {
    const order = await db.transaction(async (tx) => {
      await tx.select({ id: spendRequests.id }).from(spendRequests).where(eq(spendRequests.id, row.id)).for("update");
      const result = await cancelOrderForPurchase(tx, row.id);
      if (result === "shipped" && reversed) await orderShippedButUnpaid(tx, row);
      return result;
    });
    if (order === "cancelled") {
      await logActivity(db, { ownerId: row.ownerId, agentId: row.agentId, spendRequestId: row.id, type: "ORDER_CANCELLED", summary: "The store's order was cancelled because the payment was refunded" });
    }
  }
  await logActivity(db, {
    ownerId: row.ownerId,
    agentId: row.agentId,
    spendRequestId: row.id,
    type: "PAYMENT_REFUNDED",
    amountCents: amountCents ?? undefined,
    summary: reversed
      ? `PayPal reversed ${amountCents ? formatUsd(amountCents) : "a payment"} to the store`
      : `The store refunded ${amountCents ? formatUsd(amountCents) : "a payment"} to your PayPal`,
  });
  return reversed ? "noted_reversal" : "noted_refund";
}

// ------------------------------------------- reconciliation with PayPal

// PayPal took the money for a purchase Cosign had recorded as not paid: count
// it as paid (the hold's spent total goes up, the store gets its order) and
// tell the owner. False if the hold has no room left on Cosign's side - then
// the hold is frozen for the owner to sort out.
async function correctToPaid(row: SpendRow, captureId: string, pending: boolean): Promise<boolean> {
  try {
    const corrected = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(spendRequests).where(eq(spendRequests.id, row.id)).for("update");
      if (!current || current.status === "COMPLETED") return false;
      const released = current.status !== "PROCESSING" && current.status !== "PENDING_APPROVAL";
      await tx
        .update(holds)
        .set(
          released
            ? { capturedCents: sql`${holds.capturedCents} + ${current.totalCents}` }
            : { capturedCents: sql`${holds.capturedCents} + ${current.totalCents}`, reservedCents: sql`${holds.reservedCents} - ${current.totalCents}` },
        )
        .where(eq(holds.id, current.holdId!));
      const [updated] = await tx
        .update(spendRequests)
        .set({ status: "COMPLETED", paypalCaptureId: captureId, paidAt: new Date() })
        .where(eq(spendRequests.id, current.id))
        .returning();
      await createOrderForPaidPurchase(tx, updated!, { paymentPending: pending });
      await logActivity(tx, {
        ownerId: current.ownerId,
        agentId: current.agentId,
        spendRequestId: current.id,
        type: "PAYMENT_NEEDS_REVIEW",
        amountCents: current.totalCents,
        summary: `PayPal took ${formatUsd(current.totalCents)} for this purchase after Cosign recorded it as not paid. It now counts as paid.`,
      });
      return true;
    });
    return corrected;
  } catch {
    // Most likely the hold's own limit (captured + reserved <= amount).
    await freezeHold(row.holdId!, `PayPal took ${formatUsd(row.totalCents)} that does not fit this hold in Cosign. Spending from it is paused until you check with the store.`);
    return false;
  }
}

// Stops all spending from a hold whose PayPal record disagrees with Cosign's.
async function freezeHold(holdId: string, summary: string) {
  const [frozen] = await db
    .update(holds)
    .set({ frozenAt: new Date() })
    .where(and(eq(holds.id, holdId), isNull(holds.frozenAt)))
    .returning({ ownerId: holds.ownerId, slipId: holds.slipId });
  if (!frozen) return;
  const [slip] = await db.select({ agentId: slips.agentId }).from(slips).where(eq(slips.id, frozen.slipId));
  await logActivity(db, { ownerId: frozen.ownerId, agentId: slip?.agentId, type: "PAYMENT_NEEDS_REVIEW", summary, data: { holdId } });
}

// Daily: compare each live hold with PayPal's own list of captures on it.
// Purchases PayPal shows as paid are settled or corrected; any difference that
// remains freezes the hold. This is the check that does not trust Cosign's
// own counters.
export async function reconcileHolds(): Promise<{ checked: number; corrected: number; frozen: number }> {
  const live = await db
    .select()
    .from(holds)
    .where(and(eq(holds.status, "ACTIVE"), isNotNull(holds.paypalOrderId), isNull(holds.frozenAt)))
    .limit(200);
  const out = { checked: 0, corrected: 0, frozen: 0 };
  for (const hold of live) {
    let captures;
    try {
      captures = (await capturesOnOrder(hold.paypalOrderId!)).filter((c) => COUNTED_CAPTURE.has(c.status));
    } catch {
      continue; // PayPal unreachable: try again tomorrow
    }
    out.checked++;
    for (const c of captures) {
      if (!isUuid(c.invoiceId)) continue;
      const [row] = await db.select().from(spendRequests).where(and(eq(spendRequests.id, c.invoiceId), eq(spendRequests.holdId, hold.id)));
      if (!row || row.status === "COMPLETED") continue;
      if (row.status === "PROCESSING" && c.amountCents === row.totalCents) {
        await settle(row, c.id, null, c.status === "PENDING");
        out.corrected++;
      } else if (c.amountCents === row.totalCents && (await correctToPaid(row, c.id, c.status === "PENDING"))) {
        out.corrected++;
      }
    }
    const paypalTotal = captures.reduce((sum, c) => sum + c.amountCents, 0);
    const [now] = await db.select({ captured: holds.capturedCents }).from(holds).where(eq(holds.id, hold.id));
    if (now && now.captured !== paypalTotal) {
      await freezeHold(hold.id, `PayPal shows ${formatUsd(paypalTotal)} paid from this hold, Cosign ${formatUsd(now.captured)}. Spending from it is paused until you check it.`);
      out.frozen++;
    }
  }
  return out;
}

// Daily: purchases still processing (PayPal's answer was lost and the agent
// never asked again) are retried with their original request ID.
export async function resumeStuckPurchases(): Promise<number> {
  const stuck = await db
    .select()
    .from(spendRequests)
    .where(and(eq(spendRequests.status, "PROCESSING"), lt(spendRequests.createdAt, new Date(Date.now() - 5 * 60_000))))
    .limit(50);
  for (const row of stuck) await capture(row);
  return stuck.length;
}

// ------------------------------------------------------------ approvals

// Releases reservations for approvals that ran out of time. Called before an
// owner sees or acts on approvals, so nothing stays held past its expiry.
// The shared demo account: purchases an earlier visitor left waiting would
// greet the next one. On each demo sign-in and bot run, anything waiting for
// more than 15 minutes expires (its reserved amount goes back to the hold), so
// a visitor sees only what their own run creates.
export async function clearStaleDemoApprovals(ownerId: string): Promise<void> {
  if (!isDemoOwner(ownerId)) return;
  await db
    .update(approvals)
    .set({ expiresAt: new Date() })
    .where(and(eq(approvals.ownerId, ownerId), eq(approvals.status, "PENDING"), lt(approvals.createdAt, new Date(Date.now() - 15 * 60_000))));
  await expireApprovals(ownerId);
}

export async function expireApprovals(ownerId: string) {
  await db.transaction(async (tx) => {
    const stale = await tx
      .select({ approvalId: approvals.id, spendId: spendRequests.id, holdId: spendRequests.holdId, total: spendRequests.totalCents })
      .from(approvals)
      .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
      .where(and(eq(approvals.ownerId, ownerId), eq(approvals.status, "PENDING"), lt(approvals.expiresAt, new Date())))
      .for("update");
    for (const s of stale) {
      await tx.update(approvals).set({ status: "EXPIRED", decidedAt: new Date() }).where(eq(approvals.id, s.approvalId));
      await tx.update(spendRequests).set({ status: "APPROVAL_EXPIRED" }).where(eq(spendRequests.id, s.spendId));
      if (s.holdId) await tx.update(holds).set({ reservedCents: sql`${holds.reservedCents} - ${s.total}` }).where(eq(holds.id, s.holdId));
    }
  });
}

export async function listPendingApprovals(ownerId: string) {
  await expireApprovals(ownerId);
  return db
    .select({ approval: approvals, spend: spendRequests, agentName: agents.name, storeName: stores.name })
    .from(approvals)
    .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
    .innerJoin(agents, eq(agents.id, spendRequests.agentId))
    .innerJoin(stores, eq(stores.id, spendRequests.storeId))
    .where(and(eq(approvals.ownerId, ownerId), eq(approvals.status, "PENDING"), gt(approvals.expiresAt, new Date())))
    .orderBy(desc(approvals.createdAt));
}

// What the shared demo keeps in each hold for the demo bot's own purchases.
const DEMO_RESERVE_CENTS = 6000;

export async function decideApproval(
  ownerId: string,
  approvalId: string,
  decision: "approve" | "deny",
  seen: { cartHash: string; totalCents: number },
): Promise<SpendRow> {
  await expireApprovals(ownerId);
  // If the purchase's budget period has ended, switch periods first: the
  // rollover declines approvals from the old period instead of paying them.
  if (z.uuid().safeParse(approvalId).success) {
    const [owned] = await db
      .select({ agentId: spendRequests.agentId, hold: holds })
      .from(approvals)
      .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
      .leftJoin(holds, eq(holds.id, spendRequests.holdId))
      .where(and(eq(approvals.id, approvalId), eq(approvals.ownerId, ownerId)));
    if (owned) await rollOverAgentIfDue(owned.agentId);
    // The shared demo account: approving pays from holds every visitor shares,
    // so keep a reserve for the demo bot's own purchases.
    if (owned?.hold && decision === "approve" && isDemoOwner(ownerId)) {
      const leftAfter = owned.hold.amountCents - owned.hold.capturedCents - owned.hold.reservedCents;
      if (leftAfter < DEMO_RESERVE_CENTS) {
        throw new ServiceError(409, "demo_reserve", "In the shared demo, the last part of each budget hold is kept for the demo bot, so this one can only be declined.");
      }
    }
  }
  const row = await db.transaction(async (tx) => {
    const [found] = await tx
      .select({ approval: approvals, spend: spendRequests })
      .from(approvals)
      .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
      .where(and(eq(approvals.id, approvalId), eq(approvals.ownerId, ownerId)))
      .for("update");
    if (!found) throw notFound("Approval");
    const { approval, spend } = found;
    if (approval.status !== "PENDING") throw new ServiceError(409, "already_decided", "This purchase was already decided or has expired.");
    // The owner approves exactly what they saw: same cart, same amount.
    if (seen.cartHash !== approval.cartHash || seen.totalCents !== approval.totalCents || spend.cartHash !== approval.cartHash) {
      throw new ServiceError(409, "cart_changed", "This purchase changed after you saw it. Nothing was charged.");
    }

    if (decision === "deny") {
      await tx.update(approvals).set({ status: "DENIED", decidedAt: new Date() }).where(eq(approvals.id, approvalId));
      if (spend.holdId) await tx.update(holds).set({ reservedCents: sql`${holds.reservedCents} - ${spend.totalCents}` }).where(eq(holds.id, spend.holdId));
      const [denied] = await tx.update(spendRequests).set({ status: "DENIED" }).where(eq(spendRequests.id, spend.id)).returning();
      await logActivity(tx, { ownerId, agentId: spend.agentId, spendRequestId: spend.id, type: "APPROVAL_DENIED", amountCents: spend.totalCents, summary: `You declined ${formatUsd(spend.totalCents)}` });
      return denied!;
    }

    const [agent] = await tx.select().from(agents).where(eq(agents.id, spend.agentId)).for("update");
    if (agent?.status !== "ACTIVE") throw new ServiceError(409, "agent_not_active", "This agent is paused or revoked, so the purchase cannot go ahead.");
    const [hold] = spend.holdId ? await tx.select().from(holds).where(eq(holds.id, spend.holdId)) : [];
    if (hold?.status !== "ACTIVE") throw new ServiceError(409, "no_active_hold", "The budget hold for this store is no longer active.");

    await tx.update(approvals).set({ status: "APPROVED", decidedAt: new Date() }).where(eq(approvals.id, approvalId));
    const [processing] = await tx.update(spendRequests).set({ status: "PROCESSING" }).where(eq(spendRequests.id, spend.id)).returning();
    await logActivity(tx, { ownerId, agentId: spend.agentId, spendRequestId: spend.id, type: "APPROVAL_GRANTED", amountCents: spend.totalCents, summary: `You approved ${formatUsd(spend.totalCents)}` });
    return processing!;
  });
  return row.status === "PROCESSING" ? capture(row) : row;
}

// ------------------------------------------------------------ reads

export async function getSpendRequestForAgent(agentId: string, spendRequestId: string) {
  const [row] = await db
    .select()
    .from(spendRequests)
    .where(and(eq(spendRequests.id, spendRequestId), eq(spendRequests.agentId, agentId)));
  if (!row) throw notFound("Spend request");
  return resumeIfStuck(row);
}

export async function listSpendRequestsForAgent(agentId: string, limit = 25) {
  return db.select().from(spendRequests).where(eq(spendRequests.agentId, agentId)).orderBy(desc(spendRequests.createdAt)).limit(limit);
}

export async function listSpendRequestsForOwner(ownerId: string, agentId: string, limit = 25) {
  return db
    .select({ spend: spendRequests, storeName: stores.name })
    .from(spendRequests)
    .innerJoin(stores, eq(stores.id, spendRequests.storeId))
    .where(and(eq(spendRequests.ownerId, ownerId), eq(spendRequests.agentId, agentId)))
    .orderBy(desc(spendRequests.createdAt))
    .limit(limit);
}

// Public shape for the agent API: no PayPal IDs, no owner data.
// The order behind a paid purchase, as the agent may see it: status and the
// address label only, never the address itself.
type OrderSummary = { status: string; shipTo: unknown };
const orderForAgent = (order: OrderSummary | null | undefined) =>
  order ? { status: order.status, ships_to: (order.shipTo as { label?: string } | null)?.label ?? null } : null;

export function toApi(row: SpendRow, order?: OrderSummary | null) {
  const decision = row.decision as { outcome: string; reasons: unknown[]; rule_version: number | null; intent_check: unknown };
  return {
    id: row.id,
    agent_id: row.agentId,
    store_id: row.storeId,
    items: row.items,
    total: { amount_cents: row.totalCents, currency: row.currency },
    purpose: row.purpose,
    status: row.status,
    decision,
    cart_hash: row.cartHash,
    approval_expires_at: row.approvalExpiresAt?.toISOString() ?? null,
    receipt: row.status === "COMPLETED" ? { receipt_id: `rcpt_${row.id.slice(0, 8)}`, paid: { amount_cents: row.totalCents, currency: row.currency }, paid_at: row.paidAt?.toISOString() } : null,
    order: orderForAgent(order),
    created_at: row.createdAt.toISOString(),
  };
}
