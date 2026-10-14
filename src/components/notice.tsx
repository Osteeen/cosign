// One-line outcome messages shown after an action redirects back.
// Unknown codes show nothing, so a crafted URL cannot inject text.

const MESSAGES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  "slip-created": { tone: "ok", text: "Slip co-signed. Now approve each store's budget hold in PayPal - it takes a minute." },
  "hold-approved": { tone: "ok", text: "Budget hold approved." },
  "holds-all-approved": { tone: "ok", text: "All budget holds approved. Your agent can now spend within its permission slip." },
  "hold-cancelled": { tone: "warn", text: "You left PayPal without approving, so nothing was held. You can try again below." },
  "renewal-started": { tone: "ok", text: "Renewal started. Approve next period's budget holds in PayPal - the current period keeps working meanwhile." },
  "renewal-approved": { tone: "ok", text: "Renewed. The new budget period starts automatically when this one ends." },
  slip_ends: { tone: "warn", text: "This slip ends with the current period, so there is nothing to renew." },
  slip_not_active: { tone: "warn", text: "Only an active slip can be renewed." },
  "slip-ended": { tone: "ok", text: "Slip ended. Pending purchases were declined and the rest of each hold was released." },
  "agent-paused": { tone: "ok", text: "Agent paused. It cannot spend until you resume it." },
  "agent-resumed": { tone: "ok", text: "Agent resumed." },
  "agent-revoked": { tone: "ok", text: "Agent revoked. Its keys no longer work and its holds were released." },
  "approval-paid": { tone: "ok", text: "Approved and paid. PayPal paid the store from the budget hold." },
  "approval-denied": { tone: "ok", text: "Declined. Nothing was charged." },
  "approval-payment-failed": { tone: "bad", text: "Approved, but PayPal did not take the payment. Nothing was charged." },
  cart_changed: { tone: "bad", text: "That purchase changed after you saw it, so it was not approved. Nothing was charged." },
  already_decided: { tone: "warn", text: "That purchase was already decided or has expired." },
  agent_not_active: { tone: "warn", text: "That agent is paused or revoked, so the purchase cannot go ahead." },
  no_active_hold: { tone: "warn", text: "The budget hold for that store is no longer active." },
  hold_closed: { tone: "warn", text: "That hold was closed before you approved it. Nothing was held." },
  not_approved: { tone: "warn", text: "PayPal has not approved that hold yet. Try the approval link again." },
  hold_mismatch: { tone: "bad", text: "PayPal returned a different store or amount, so the hold was not used." },
  agent_revoked: { tone: "warn", text: "That agent is revoked." },
  not_found: { tone: "warn", text: "That item was not found." },
  "hold-invalid": { tone: "bad", text: "That PayPal return link was not valid." },
  "address-added": { tone: "ok", text: "Address saved. Choose it on a permission slip to ship orders there." },
  "address-saved": { tone: "ok", text: "Address updated. New orders ship to it; orders already sent keep the old one." },
  "address-removed": { tone: "ok", text: "Address removed." },
  address_in_use: { tone: "warn", text: "An agent's permission slip ships to that address. Change the slip first." },
  unknown_address: { tone: "warn", text: "Choose one of your saved addresses." },
  "ship-to-changed": { tone: "ok", text: "Shipping address changed. New orders ship there; budget holds already at PayPal keep the address they were opened with." },
  "order-shipped": { tone: "ok", text: "Thanks - the owner now sees this order as shipped." },
  "order-confirmed": { tone: "ok", text: "Order confirmed. The owner can see that you have it." },
  "order-cancelled": { tone: "bad", text: "This order is cancelled because the payment did not go through. Please don't ship it." },
  payment_pending: { tone: "warn", text: "PayPal has not confirmed this payment yet. Please don't ship until it does." },
  "demo-address": { tone: "warn", text: "The demo account uses a sample address that everyone shares, so it can't be changed." },
  "demo-welcome": { tone: "ok", text: "Welcome to the Cosign demo. Everything here is PayPal sandbox - try approving or declining, the spending table, or run the demo bot." },
  "demo-blocked": { tone: "warn", text: "The demo account can't do that: it would release the shared PayPal budget holds for every other visitor. The video shows it working." },
  "hold-error": { tone: "bad", text: "Something went wrong placing the hold. Nothing was charged; try the approval link again." },
};

export function Notice({ code }: { code?: string }) {
  const m = code ? MESSAGES[code] : undefined;
  if (!m) return null;
  return (
    <p className={`notice notice-${m.tone}`} role="status">
      {m.text}
    </p>
  );
}

// Result of approving or declining several purchases. Parsed from digits only.
export function BulkNotice({ value }: { value?: string }) {
  const m = value ? /^([ad])\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(value) : null;
  if (!m) return null;
  const [done, skipped, problems] = [Number(m[2]), Number(m[3]), Number(m[4])];
  const word = (n: number) => (n === 1 ? "purchase" : "purchases");
  const parts =
    m[1] === "a"
      ? [done ? `Approved and paid ${done} ${word(done)}.` : "Nothing was paid."]
      : [done ? `Declined ${done} ${word(done)}. Nothing was charged.` : "Nothing was declined."];
  if (skipped) parts.push(`${skipped} skipped - already decided, changed or expired.`);
  if (problems) parts.push(`PayPal did not take ${problems} - nothing was charged for those, or PayPal is still confirming.`);
  const tone = problems ? "bad" : skipped ? "warn" : "ok";
  return (
    <p className={`notice notice-${tone}`} role="status">
      {parts.join(" ")}
    </p>
  );
}
