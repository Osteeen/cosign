// Budget holds on PayPal: an AUTHORIZE order with the store as payee, approved
// once by the owner; agent purchases are partial captures against it.
// Calls go through PayPal's Server SDK (Orders and Payments controllers).

import "server-only";
import {
  CheckoutPaymentIntent,
  OrdersController,
  PaymentsController,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import { authAssertion, call, PayPalError, paypalClient } from "./client";
import { centsToPayPal, payPalToCents } from "../money";

// Ask PayPal for the full order/payment in each response (we read the
// authorization out of it).
const FULL = "return=representation";

const orders = () => new OrdersController(paypalClient());
const payments = () => new PaymentsController(paypalClient());

export async function createHoldOrder(input: {
  holdId: string;
  storeMerchantId: string;
  amountCents: number;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ orderId: string; approveUrl: string }> {
  const order = await call("create hold order", () =>
    orders().createOrder({
      // Same hold, same request ID: a retry never creates a second order.
      paypalRequestId: `hold-${input.holdId}`,
      prefer: FULL,
      body: {
        intent: CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            referenceId: input.holdId,
            customId: input.holdId,
            description: "Cosign budget hold for your agent",
            amount: { currencyCode: "USD", value: centsToPayPal(input.amountCents) },
            payee: { merchantId: input.storeMerchantId },
          },
        ],
        paymentSource: {
          paypal: {
            experienceContext: {
              brandName: "Cosign (sandbox)",
              shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
              userAction: PaypalExperienceUserAction.Continue,
              returnUrl: input.returnUrl,
              cancelUrl: input.cancelUrl,
            },
          },
        },
      },
    }),
  );
  const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!order.id || !approveUrl) throw new Error("PayPal did not return an approval link");
  return { orderId: order.id, approveUrl };
}

export async function getOrder(orderId: string): Promise<{ id: string; status: string }> {
  const order = await call("get order", () => orders().getOrder({ id: orderId }));
  return { id: order.id ?? orderId, status: order.status ?? "UNKNOWN" };
}

// Places the hold after the owner approved it. Idempotent per order.
export async function authorizeOrder(orderId: string): Promise<{
  authorizationId: string;
  amountCents: number;
  payeeMerchantId: string | null;
  expiresAt: Date | null;
}> {
  const order = await call("authorize order", () =>
    orders().authorizeOrder({ id: orderId, paypalRequestId: `authorize-${orderId}`, prefer: FULL, body: {} }),
  );
  const unit = order.purchaseUnits?.[0];
  const auth = unit?.payments?.authorizations?.[0];
  if (!auth?.id || !auth.amount) throw new Error("PayPal returned no authorization");
  if (auth.amount.currencyCode !== "USD") throw new Error("Unexpected currency on hold");
  return {
    authorizationId: auth.id,
    amountCents: payPalToCents(auth.amount.value),
    payeeMerchantId: unit?.payee?.merchantId ?? null,
    expiresAt: auth.expirationTime ? new Date(auth.expirationTime) : null,
  };
}

// One agent purchase. requestId is derived from the spend request, so a retry
// returns the same capture instead of charging twice.
export async function captureFromHold(input: {
  authorizationId: string;
  amountCents: number;
  spendRequestId: string;
}): Promise<{ captureId: string; status: string }> {
  const capture = await call("capture", () =>
    payments().captureAuthorizedPayment({
      authorizationId: input.authorizationId,
      paypalRequestId: `capture-${input.spendRequestId}`,
      prefer: FULL,
      body: {
        amount: { currencyCode: "USD", value: centsToPayPal(input.amountCents) },
        finalCapture: false,
        invoiceId: input.spendRequestId,
      },
    }),
  );
  if (!capture.id || !capture.status) throw new Error("PayPal returned no capture");
  return { captureId: capture.id, status: capture.status };
}

// Renews a hold past PayPal's 3-day honor period. PayPal answers with a NEW
// authorization ID for the same hold (same 29-day expiry); captures go to the
// new ID, voids must still name the original. The request ID is tied to the
// authorization being renewed, so a retry or a parallel call gets the same answer.
export async function reauthorizeHold(input: { authorizationId: string; storeMerchantId: string }): Promise<{ authorizationId: string; status: string }> {
  const attempt = (asStore: boolean) =>
    call("reauthorize", () =>
      payments().reauthorizePayment({
        authorizationId: input.authorizationId,
        paypalRequestId: `reauth-${input.authorizationId}${asStore ? "-as-store" : ""}`,
        prefer: FULL,
        ...(asStore ? { paypalAuthAssertion: authAssertion(input.storeMerchantId) } : {}),
      }),
    );
  let auth;
  try {
    auth = await attempt(false);
  } catch (e) {
    // Multiparty holds may need the store's assertion, as voids do.
    if (e instanceof PayPalError && (e.status === 403 || e.issue === "PERMISSION_DENIED")) auth = await attempt(true);
    else throw e;
  }
  if (!auth.id || !auth.status) throw new Error("PayPal returned no reauthorization");
  return { authorizationId: auth.id, status: auth.status };
}

// Releases what is left of a hold. Needs the store's assertion.
export async function voidHold(input: { authorizationId: string; storeMerchantId: string }): Promise<void> {
  await call("void", () =>
    payments().voidPayment({
      authorizationId: input.authorizationId,
      paypalAuthAssertion: authAssertion(input.storeMerchantId),
      paypalRequestId: `void-${input.authorizationId}`,
      prefer: FULL,
    }),
  );
}

export async function refundCapture(input: {
  captureId: string;
  storeMerchantId: string;
  amountCents: number;
  refundRequestId: string;
}): Promise<{ refundId: string; status: string }> {
  const refund = await call("refund", () =>
    payments().refundCapturedPayment({
      captureId: input.captureId,
      paypalAuthAssertion: authAssertion(input.storeMerchantId),
      paypalRequestId: `refund-${input.refundRequestId}`,
      prefer: FULL,
      body: { amount: { currencyCode: "USD", value: centsToPayPal(input.amountCents) } },
    }),
  );
  if (!refund.id || !refund.status) throw new Error("PayPal returned no refund");
  return { refundId: refund.id, status: refund.status };
}
