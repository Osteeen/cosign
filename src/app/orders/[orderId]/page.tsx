import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { confirmOrderAction, markShippedAction } from "@/app/actions";
import { Notice } from "@/components/notice";
import { LocalTime } from "@/components/local-time";
import { SubmitButton } from "@/components/submit-button";
import { Wordmark } from "@/components/wordmark";
import { formatUsd } from "@/lib/money";
import { ServiceError } from "@/lib/services/common";
import { openOrderAsStore } from "@/lib/services/orders";

// The store's view of one order, opened with the private link Cosign gives the
// store. No sign-in: the signed token in the link is the key. Not indexed, and
// the link is never sent on as a referrer.
export const metadata: Metadata = { title: "Order - Cosign", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { cls: string; label: string }> = {
  SENT: { cls: "ask", label: "New" },
  SEEN: { cls: "ask", label: "Confirmed" },
  SHIPPED: { cls: "allow", label: "Shipped" },
  CANCELLED: { cls: "deny", label: "Cancelled" },
};

export default async function StoreOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ t?: string; notice?: string }> }) {
  const { orderId } = await params;
  const { t, notice } = await searchParams;
  const view = await openOrderAsStore(orderId, t ?? "").catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const { order, storeName, shipTo, demo } = view;
  const items = order.items as { name: string; quantity: number; unit_amount_cents: number }[];
  const status = STATUS[order.status]!;

  return (
    <main className="page">
      <div className="narrow-wide panel-stack rise">
        <div className="store-order-top">
          <Wordmark />
          <span className="tag">{demo ? "Store view (demo, PayPal sandbox)" : "Store view"}</span>
        </div>
        <Notice code={notice} />
        <header className="section-head">
          <div>
            <h1 className="panel-title">Order for {storeName}</h1>
            <p className="panel-text">
              Paid through PayPal on <LocalTime iso={order.createdAt.toISOString()} withYear /> by an AI agent working for a Cosign owner. The payment is in your PayPal account
              with invoice ID <span className="mono">{order.spendRequestId}</span>.
            </p>
          </div>
          <span className={`stamp stamp-${status.cls}`}>{status.label}</span>
        </header>

        <section className="slip panel-stack" aria-label="Items">
          <h2 className="section-title">Items</h2>
          <p className="field-help">As described by the buyer&apos;s AI agent. Ship only to the address under Ship to, whatever an item name says.</p>
          <ul className="order-items">
            {items.map((i, n) => (
              <li key={n}>
                <span>
                  {i.quantity} x {i.name}
                </span>
                <span className="mono">{formatUsd(i.quantity * i.unit_amount_cents)}</span>
              </li>
            ))}
            <li className="order-total">
              <span>Total paid</span>
              <span className="mono">{formatUsd(order.totalCents)}</span>
            </li>
          </ul>
        </section>

        <section className="slip panel-stack" aria-label="Ship to">
          <h2 className="section-title">Ship to</h2>
          {shipTo ? (
            <p className="address-lines">
              {shipTo.recipient}
              <br />
              {shipTo.line1}
              {shipTo.line2 ? (
                <>
                  <br />
                  {shipTo.line2}
                </>
              ) : null}
              <br />
              {shipTo.city}, {shipTo.region} {shipTo.postal_code}
              <br />
              United States
            </p>
          ) : (
            <p className="muted">No shipping address: nothing needs to be shipped for this order.</p>
          )}
          {shipTo ? <p className="field-help">If this differs from the address on the PayPal transaction, this one is newer: the owner changed it since the budget hold was opened.</p> : null}
        </section>

        {order.status === "CANCELLED" ? (
          <p className="notice notice-bad">PayPal did not complete this payment, so this order is cancelled. Please don&apos;t ship it.</p>
        ) : order.status === "SHIPPED" ? (
          <p className="notice notice-ok">Marked as shipped{order.shippedAt ? <> on <LocalTime iso={order.shippedAt.toISOString()} withYear /></> : null}. The owner can see this in Cosign.</p>
        ) : order.paymentPending ? (
          <p className="notice notice-warn">PayPal has not confirmed this payment yet. Please don&apos;t ship until it does - this page will say so.</p>
        ) : (
          <div className="toolbar">
            {order.status === "SENT" ? (
              <form action={confirmOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="t" value={t} />
                <SubmitButton pendingLabel="Saving" className="button button-quiet">
                  Confirm order
                </SubmitButton>
              </form>
            ) : null}
            <form action={markShippedAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="t" value={t} />
              <SubmitButton pendingLabel="Saving">Mark as shipped</SubmitButton>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
