// PayPal webhook events, after the signature is verified. PayPal's word on
// what happened to holds and captures keeps Cosign in step when an answer was
// lost (timeout, closed tab) or something happened outside Cosign.
//
// The PayPal app is shared with another project, so many events are not ours:
// anything that does not match one of our own orders, authorizations or spend
// requests is acknowledged and ignored. Each event is processed once (its
// PayPal event ID is the key); the handlers are also safe to repeat.
// Only the event ID, type, resource ID and outcome are stored - never the
// payload, which can carry the buyer's name and email.

import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { holds, paypalWebhookEvents, slips, stores } from "@/db/schema";
import { PayPalError } from "@/lib/paypal/client";
import { payPalToCents } from "@/lib/money";
import { logActivity, ServiceError } from "./common";
import { completeHoldApproval } from "./slips";
import { captureConfirmedByPayPal, captureFailedAtPayPal, captureRefundedAtPayPal } from "./spend";

type Resource = {
  id?: unknown;
  invoice_id?: unknown;
  amount?: { value?: unknown; currency_code?: unknown };
  links?: { rel?: unknown; href?: unknown }[];
};
export type PayPalEvent = { id: string; event_type: string; resource_type?: string; resource?: Resource };

const str = (v: unknown) => (typeof v === "string" && v.length <= 64 ? v : null);
const cents = (amount: Resource["amount"]): number | null => {
  if (amount?.currency_code !== "USD" || typeof amount.value !== "string") return null;
  try {
    return payPalToCents(amount.value);
  } catch {
    return null;
  }
};
// The parent named by a resource's "up" link: the capture a refund belongs to
// (/captures/{id}), or the authorization a capture came from (/authorizations/{id}).
const upLink = (r: Resource, kind: "captures" | "authorizations") => {
  const up = r.links?.find((l) => l.rel === "up" && typeof l.href === "string")?.href as string | undefined;
  return up?.match(new RegExp(`/${kind}/([A-Z0-9]{8,32})$`))?.[1] ?? null;
};

// Runs one verified event, once per PayPal event ID. The event's row is
// locked while it runs, so a retry that overlaps a slow first delivery waits,
// then sees it done.
export async function processPayPalEvent(event: PayPalEvent): Promise<{ duplicate: boolean; outcome: string }> {
  const resourceId = str(event.resource?.id);
  const base = { resource_type: event.resource_type ?? null, resource_id: resourceId };
  await db.insert(paypalWebhookEvents).values({ id: event.id, eventType: event.event_type, verified: true, payload: base }).onConflictDoNothing();
  return db.transaction(async (tx) => {
    const [seen] = await tx
      .select({ processedAt: paypalWebhookEvents.processedAt, payload: paypalWebhookEvents.payload })
      .from(paypalWebhookEvents)
      .where(eq(paypalWebhookEvents.id, event.id))
      .for("update");
    if (seen?.processedAt) return { duplicate: true, outcome: (seen.payload as { outcome?: string }).outcome ?? "done" };
    // Handlers write through their own transactions; only this row is held.
    const outcome = await handle(event, resourceId);
    await tx.update(paypalWebhookEvents).set({ processedAt: new Date(), payload: { ...base, outcome } }).where(eq(paypalWebhookEvents.id, event.id));
    return { duplicate: false, outcome };
  });
}

async function handle(event: PayPalEvent, resourceId: string | null): Promise<string> {
  const r = event.resource ?? {};
  if (!resourceId) return "no_resource";
  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED":
      return holdApproved(resourceId);
    case "PAYMENT.AUTHORIZATION.VOIDED":
      return holdVoided(resourceId);
    case "PAYMENT.CAPTURE.COMPLETED":
      return captureConfirmedByPayPal(r.invoice_id, resourceId, cents(r.amount), upLink(r, "authorizations"));
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED":
      return captureFailedAtPayPal(r.invoice_id, resourceId);
    case "PAYMENT.CAPTURE.REFUNDED":
    case "PAYMENT.CAPTURE.REVERSED": {
      const captureId = upLink(r, "captures");
      return captureId ? captureRefundedAtPayPal(captureId, cents(r.amount), event.event_type === "PAYMENT.CAPTURE.REVERSED") : "no_capture_link";
    }
    default:
      return "not_handled";
  }
}

// The owner approved a budget hold at PayPal but never came back to Cosign
// (closed the tab): place it now. The owner comes from our own hold row, and
// PayPal must still confirm the store and amount (completeHoldApproval).
async function holdApproved(orderId: string): Promise<string> {
  const [hold] = await db.select({ ownerId: holds.ownerId, status: holds.status }).from(holds).where(eq(holds.paypalOrderId, orderId));
  if (!hold) return "not_ours";
  if (hold.status !== "AWAITING_APPROVAL") return `already_${hold.status.toLowerCase()}`;
  try {
    await completeHoldApproval(hold.ownerId, orderId);
    return "hold_placed";
  } catch (e) {
    // A refusal (closed, mismatch, or PayPal saying no) is final; an unknown
    // outcome (timeout, PayPal down) is retried by PayPal.
    if (e instanceof ServiceError) return `hold_${e.code}`;
    if (e instanceof PayPalError && e.definite) return `hold_paypal_${(e.issue ?? String(e.status)).toLowerCase()}`;
    throw e;
  }
}

// PayPal voided a hold Cosign still counts as live (it was not one of our own
// releases, which close the slip or period first): stop using it and tell the owner.
async function holdVoided(authorizationId: string): Promise<string> {
  const [row] = await db
    .select({ hold: holds, slip: slips, store: stores.name })
    .from(holds)
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .where(or(eq(holds.paypalAuthorizationId, authorizationId), eq(holds.paypalCurrentAuthorizationId, authorizationId)));
  if (!row) return "not_ours";
  if (row.hold.status !== "ACTIVE") return `already_${row.hold.status.toLowerCase()}`;
  // Our own releases close the slip or move past the period first. The current
  // period's hold and an approved renewal hold are live: PayPal voided them.
  if (row.slip.status !== "ACTIVE" || row.hold.periodIndex < row.slip.currentPeriodIndex) return "own_release";
  const [updated] = await db
    .update(holds)
    .set({ status: "RELEASED", releasedAt: new Date() })
    .where(and(eq(holds.id, row.hold.id), eq(holds.status, "ACTIVE")))
    .returning({ id: holds.id });
  if (!updated) return "already_released";
  await logActivity(db, {
    ownerId: row.hold.ownerId,
    agentId: row.slip.agentId,
    type: "HOLD_RELEASED",
    summary:
      row.hold.periodIndex > row.slip.currentPeriodIndex
        ? `PayPal released the renewal hold at ${row.store}. Approve it again before the next period starts.`
        : `PayPal released the budget hold at ${row.store}. Your agent can no longer pay that store this period.`,
    data: { holdId: row.hold.id, by: "paypal" },
  });
  return "hold_released";
}
