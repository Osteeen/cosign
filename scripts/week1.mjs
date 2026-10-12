// Week 1 sandbox test: can the platform charge a platform-level vaulted PayPal
// wallet to an onboarded store with no buyer present?
//
// Run from cosign/:  node --env-file=.env.local scripts/week1.mjs <command> [args]
//
// SANDBOX ONLY. Never prints the client secret or access tokens. Run state
// (merchant ids, setup/payment token ids, order ids) goes to
// scripts/.week1-state.json, which is gitignored.

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://api-m.sandbox.paypal.com";
const RETURN_URL = "https://localhost/cosign/return";
const CANCEL_URL = "https://localhost/cosign/cancel";
const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), ".week1-state.json");

const REQUIRED_ENV = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_PARTNER_MERCHANT_ID"];

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (expected in .env.local)`);
  return v;
}

function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : { stores: {} };
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
}

let cachedToken;
async function accessToken() {
  if (cachedToken) return cachedToken;
  const basic = Buffer.from(`${env("PAYPAL_CLIENT_ID")}:${env("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OAuth failed: HTTP ${res.status} ${body.error ?? ""} ${body.error_description ?? ""}`);
  cachedToken = { token: body.access_token, scope: body.scope ?? "", appId: body.app_id };
  return cachedToken;
}

// Unsigned JWT that tells PayPal which merchant the platform is acting for.
function authAssertion(merchantId) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ iss: env("PAYPAL_CLIENT_ID"), payer_id: merchantId })}.`;
}

async function call(method, path, { body, assertFor, requestId } = {}) {
  const { token } = await accessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (assertFor) headers["PayPal-Auth-Assertion"] = authAssertion(assertFor);
  if (method !== "GET") headers["PayPal-Request-Id"] = requestId ?? randomUUID();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 500) }; }
  return { status: res.status, ok: res.ok, debugId: res.headers.get("paypal-debug-id"), date: res.headers.get("date"), json };
}

// Errors carry no secrets; print enough to diagnose.
function report(label, r) {
  console.log(`\n${label}: HTTP ${r.status}${r.debugId ? ` (debug_id ${r.debugId})` : ""}${r.date ? ` at ${r.date}` : ""}`);
  if (!r.ok) {
    const { name, message, details, error, error_description } = r.json;
    console.log(JSON.stringify({ name, message, details, error, error_description }, null, 2));
  }
}

const link = (json, rel) => json.links?.find((l) => l.rel === rel)?.href;

const commands = {
  // Env present, OAuth works, and which relevant scopes the app has.
  async check() {
    for (const n of REQUIRED_ENV) console.log(`${n}: ${process.env[n] ? "set" : "MISSING"}`);
    const { scope, appId } = await accessToken();
    console.log(`OAuth: ok (app ${appId})`);
    const wanted = ["vault", "partnerreferrals", "customer/partner", "payments/payment", "checkout"];
    for (const w of wanted) {
      const hits = scope.split(" ").filter((s) => s.includes(w));
      console.log(`scope "${w}": ${hits.length ? hits.join(", ") : "none"}`);
    }
  },

  // Create a Partner Referrals onboarding link for a store (label: store1 | store2).
  async referral(label) {
    if (!label) throw new Error("usage: referral <store1|store2>");
    const trackingId = `cosign-${label}-${Date.now()}`;
    const r = await call("POST", "/v2/customer/partner-referrals", {
      body: {
        tracking_id: trackingId,
        operations: [{
          operation: "API_INTEGRATION",
          api_integration_preference: {
            rest_api_integration: {
              integration_method: "PAYPAL",
              integration_type: "THIRD_PARTY",
              // VAULT + BILLING_AGREEMENT let the platform save a buyer's PayPal for this store.
              third_party_details: { features: ["PAYMENT", "REFUND", "VAULT", "BILLING_AGREEMENT"] },
            },
          },
        }],
        products: ["PPCP", "ADVANCED_VAULTING"],
        capabilities: ["PAYPAL_WALLET_VAULTING_ADVANCED"],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
        partner_config_override: { return_url: RETURN_URL },
      },
    });
    report(`partner-referral ${label}`, r);
    if (!r.ok) return;
    const state = loadState();
    state.stores[label] = { trackingId, merchantId: null };
    saveState(state);
    console.log(`tracking_id: ${trackingId}`);
    console.log(`ONBOARDING LINK (sign in as the Cosign ${label} sandbox business account):\n${link(r.json, "action_url")}`);
  },

  // After onboarding: look up the store's merchant id by tracking_id and show its status.
  async store(label) {
    const state = loadState();
    const s = state.stores[label];
    if (!s) throw new Error(`no referral recorded for ${label}`);
    const partner = env("PAYPAL_PARTNER_MERCHANT_ID");
    const lookup = await call("GET", `/v1/customer/partners/${partner}/merchant-integrations?tracking_id=${encodeURIComponent(s.trackingId)}`);
    report(`lookup ${label}`, lookup);
    if (!lookup.ok) return;
    s.merchantId = lookup.json.merchant_id;
    saveState(state);
    const st = await call("GET", `/v1/customer/partners/${partner}/merchant-integrations/${s.merchantId}`);
    report(`status ${label}`, st);
    if (!st.ok) return;
    const j = st.json;
    console.log(JSON.stringify({
      merchant_id: j.merchant_id,
      payments_receivable: j.payments_receivable,
      primary_email_confirmed: j.primary_email_confirmed,
      products: j.products?.map((p) => ({ name: p.name, vetting_status: p.vetting_status, capabilities: p.capabilities })),
      capabilities: j.capabilities?.map((c) => ({ name: c.name, status: c.status })),
      oauth_scopes: j.oauth_integrations?.flatMap((o) => o.oauth_third_party?.flatMap((t) => t.scopes) ?? []),
    }, null, 2));
  },

  // Setup token. assertAs: "platform" (default), "none", or a store label.
  // usageType: PLATFORM (default) or MERCHANT, to isolate which one is refused.
  async "setup-token"(assertAs = "platform", usageType = "PLATFORM") {
    const state = loadState();
    const assertFor = assertAs === "none" ? undefined
      : assertAs === "platform" ? env("PAYPAL_PARTNER_MERCHANT_ID") : state.stores[assertAs]?.merchantId;
    if (assertAs !== "none" && !assertFor) throw new Error(`no merchant id for ${assertAs}`);
    const r = await call("POST", "/v3/vault/setup-tokens", {
      assertFor,
      body: {
        customer: { merchant_customer_id: "cosign-week1-buyer" },
        payment_source: {
          paypal: {
            description: "Cosign sandbox test - lets your approved agents pay stores on Cosign",
            permit_multiple_payment_tokens: false,
            usage_pattern: "IMMEDIATE",
            usage_type: usageType,
            customer_type: "CONSUMER",
            experience_context: {
              shipping_preference: "NO_SHIPPING",
              brand_name: "Cosign (sandbox)",
              locale: "en-US",
              return_url: RETURN_URL,
              cancel_url: CANCEL_URL,
            },
          },
        },
      },
    });
    report(`setup-token (assertion: ${assertAs}, usage_type: ${usageType})`, r);
    if (!r.ok) return;
    state.setupToken = { id: r.json.id, customerId: r.json.customer?.id, assertAs, status: r.json.status };
    saveState(state);
    console.log(`setup token ${r.json.id}, status ${r.json.status}, customer ${r.json.customer?.id}`);
    console.log(`APPROVAL LINK (sign in as the Cosign sandbox buyer):\n${link(r.json, "approve")}`);
  },

  // Exchange the approved setup token for a payment token (the vault id).
  async "payment-token"() {
    const state = loadState();
    if (!state.setupToken) throw new Error("run setup-token first");
    const a = state.setupToken.assertAs;
    const assertFor = a === "none" ? undefined
      : a === "platform" ? env("PAYPAL_PARTNER_MERCHANT_ID") : state.stores[a].merchantId;
    const r = await call("POST", "/v3/vault/payment-tokens", {
      assertFor,
      body: {
        customer: { merchant_customer_id: "cosign-week1-buyer" },
        payment_source: { token: { id: state.setupToken.id, type: "SETUP_TOKEN" } },
      },
    });
    report("payment-token", r);
    if (!r.ok) return;
    const p = r.json.payment_source?.paypal ?? {};
    state.paymentToken = { id: r.json.id, customerId: r.json.customer?.id, usageType: p.usage_type };
    saveState(state);
    console.log(`payment token saved (usage_type ${p.usage_type}, customer ${r.json.customer?.id})`);
  },

  // The real test: charge the vaulted wallet to a store, no buyer present.
  async charge(label = "store1", value = "12.34") {
    const state = loadState();
    const store = state.stores[label];
    if (!store?.merchantId) throw new Error(`run store ${label} first`);
    if (!state.paymentToken) throw new Error("run payment-token first");
    if (!/^\d+\.\d{2}$/.test(value)) throw new Error("amount must look like 12.34");
    const requestId = randomUUID();
    const r = await call("POST", "/v2/checkout/orders", {
      assertFor: store.merchantId,
      requestId,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: `cosign-week1-${label}`,
          amount: { currency_code: "USD", value },
          payee: { merchant_id: store.merchantId },
        }],
        payment_source: { paypal: { attributes: { customer: { merchant_customer_id: "cosign-week1-buyer" }, vault_id: state.paymentToken.id } } },
      },
    });
    report(`order to ${label} for $${value}`, r);
    if (!r.ok) return;
    const pu = r.json.purchase_units?.[0];
    const cap = pu?.payments?.captures?.[0];
    state.charges = [...(state.charges ?? []), { label, value, orderId: r.json.id, status: r.json.status, captureId: cap?.id, requestId }];
    saveState(state);
    console.log(JSON.stringify({
      order_id: r.json.id,
      order_status: r.json.status,
      payee: pu?.payee,
      capture: cap && { id: cap.id, status: cap.status, amount: cap.amount, breakdown: cap.seller_receivable_breakdown },
      payer_action_link: link(r.json, "payer-action") ?? null,
    }, null, 2));
  },

  // Refund the latest capture, acting as the store.
  async refund() {
    const state = loadState();
    const last = state.charges?.at(-1);
    if (!last?.captureId) throw new Error("no captured charge to refund");
    const r = await call("POST", `/v2/payments/captures/${last.captureId}/refund`, {
      assertFor: state.stores[last.label].merchantId,
      body: {},
    });
    report(`refund capture ${last.captureId}`, r);
    if (r.ok) console.log(`refund ${r.json.id}: ${r.json.status}`);
  },

  // Budget hold (fallback for Vault): the buyer approves ONE authorization to the
  // store for the agent's budget; purchases are then partial captures with no buyer.
  async "hold-create"(label = "store1", value = "50.00") {
    const state = loadState();
    const store = state.stores[label];
    if (!store?.merchantId) throw new Error(`run store ${label} first`);
    if (!/^\d+\.\d{2}$/.test(value)) throw new Error("amount must look like 50.00");
    const r = await call("POST", "/v2/checkout/orders", {
      body: {
        intent: "AUTHORIZE",
        purchase_units: [{
          reference_id: `cosign-hold-${label}`,
          description: "Cosign sandbox test - agent budget hold",
          amount: { currency_code: "USD", value },
          payee: { merchant_id: store.merchantId },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: RETURN_URL, cancel_url: CANCEL_URL, shipping_preference: "NO_SHIPPING",
              brand_name: "Cosign (sandbox)", user_action: "CONTINUE",
            },
          },
        },
      },
    });
    report(`hold order at ${label} for $${value}`, r);
    if (!r.ok) return;
    state.hold = { label, value, orderId: r.json.id, authorizationId: null, captures: [] };
    saveState(state);
    console.log(`order ${r.json.id} status ${r.json.status}, payee ${r.json.purchase_units?.[0]?.payee?.merchant_id ?? store.merchantId}`);
    console.log(`APPROVAL LINK (Cosign Buyer profile):\n${link(r.json, "payer-action")}`);
  },

  // After the buyer approves: place the hold. No buyer involved from here on.
  async "hold-authorize"() {
    const state = loadState();
    if (!state.hold?.orderId) throw new Error("run hold-create first");
    const r = await call("POST", `/v2/checkout/orders/${state.hold.orderId}/authorize`, { body: {} });
    report(`authorize order ${state.hold.orderId}`, r);
    if (!r.ok) return;
    const pu = r.json.purchase_units?.[0];
    const auth = pu?.payments?.authorizations?.[0];
    state.hold.authorizationId = auth?.id;
    state.hold.payer = r.json.payer?.email_address;
    saveState(state);
    console.log(JSON.stringify({
      order_status: r.json.status, payee: pu?.payee?.merchant_id, payer: r.json.payer?.email_address,
      authorization: auth && { id: auth.id, status: auth.status, amount: auth.amount, expiration_time: auth.expiration_time },
    }, null, 2));
  },

  // An agent purchase: partial capture against the hold, no buyer present.
  async "hold-capture"(value) {
    const state = loadState();
    const h = state.hold;
    if (!h?.authorizationId) throw new Error("run hold-authorize first");
    if (!/^\d+\.\d{2}$/.test(value ?? "")) throw new Error("usage: hold-capture 12.34");
    const requestId = randomUUID();
    const r = await call("POST", `/v2/payments/authorizations/${h.authorizationId}/capture`, {
      requestId,
      body: { amount: { currency_code: "USD", value }, final_capture: false, invoice_id: `cosign-week1-${Date.now()}` },
    });
    report(`capture $${value} from hold`, r);
    if (!r.ok) return;
    h.captures.push({ id: r.json.id, value, status: r.json.status, requestId });
    saveState(state);
    const c = await call("GET", `/v2/payments/captures/${r.json.id}`);
    console.log(JSON.stringify({
      capture_id: r.json.id, status: r.json.status, amount: c.json.amount,
      payee: c.json.payee?.merchant_id, breakdown: c.json.seller_receivable_breakdown,
    }, null, 2));
  },

  // Release the rest of the hold (needs the store's assertion).
  async "hold-void"() {
    const state = loadState();
    const h = state.hold;
    if (!h?.authorizationId) throw new Error("no hold");
    const r = await call("POST", `/v2/payments/authorizations/${h.authorizationId}/void`, {
      assertFor: state.stores[h.label].merchantId,
    });
    report(`void hold ${h.authorizationId}`, r);
    const a = await call("GET", `/v2/payments/authorizations/${h.authorizationId}`, { assertFor: state.stores[h.label].merchantId });
    report("authorization after void", a);
    if (a.ok) console.log(`authorization status: ${a.json.status}`);
  },

  // Refund one capture from the hold (acting as the store).
  async "hold-refund"(index = "0") {
    const state = loadState();
    const cap = state.hold?.captures?.[Number(index)];
    if (!cap) throw new Error("no such capture");
    const r = await call("POST", `/v2/payments/captures/${cap.id}/refund`, {
      assertFor: state.stores[state.hold.label].merchantId,
      body: {},
    });
    report(`refund capture ${cap.id}`, r);
    if (r.ok) console.log(`refund ${r.json.id}: ${r.json.status}`);
  },

  // Alternative path: save the buyer's PayPal during a first purchase at the
  // store (Orders API store_in_vault). The buyer approves this one order; the
  // response then carries a vault id for later no-buyer charges.
  async "vault-order"(label = "store1", value = "1.00") {
    const state = loadState();
    const store = state.stores[label];
    if (!store?.merchantId) throw new Error(`run store ${label} first`);
    const r = await call("POST", "/v2/checkout/orders", {
      assertFor: store.merchantId,
      body: {
        intent: "CAPTURE",
        purchase_units: [{ reference_id: `cosign-week1-first-${label}`, amount: { currency_code: "USD", value } }],
        payment_source: {
          paypal: {
            attributes: { vault: { store_in_vault: "ON_SUCCESS", usage_type: "MERCHANT", customer_type: "CONSUMER" } },
            experience_context: {
              return_url: RETURN_URL, cancel_url: CANCEL_URL, shipping_preference: "NO_SHIPPING",
              brand_name: "Cosign (sandbox)", user_action: "PAY_NOW",
            },
          },
        },
      },
    });
    report(`vault-order at ${label} for $${value}`, r);
    if (!r.ok) return;
    state.vaultOrder = { label, orderId: r.json.id };
    saveState(state);
    console.log(`order ${r.json.id} status ${r.json.status}`);
    console.log(`APPROVAL LINK (sign in as the Cosign buyer):\n${link(r.json, "payer-action")}`);
  },

  // Diagnostic: can we act for this store at all? Creates an unpaid order
  // (buyer never approves it, so it simply expires).
  async probe(label = "store1") {
    const store = loadState().stores[label];
    if (!store?.merchantId) throw new Error(`run store ${label} first`);
    const r = await call("POST", "/v2/checkout/orders", {
      assertFor: store.merchantId,
      body: {
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: "1.00" } }],
        payment_source: { paypal: { experience_context: { return_url: RETURN_URL, cancel_url: CANCEL_URL } } },
      },
    });
    report(`probe order as ${label} (auth-assertion, no payee field)`, r);
    if (r.ok) console.log(`order ${r.json.id} status ${r.json.status}, payee ${r.json.purchase_units?.[0]?.payee?.merchant_id}`);
  },

  async state() {
    console.log(JSON.stringify(loadState(), null, 2));
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log(`commands: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}
commands[cmd](...args).catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
