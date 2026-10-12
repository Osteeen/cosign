// SANDBOX test: can one PayPal approval hold money for several stores?
// Tries one order with two purchase units (one per store) under AUTHORIZE and
// CAPTURE intents. Creating the order is enough to see what PayPal allows;
// nothing is approved or charged. Never prints credentials or tokens.
//   node --env-file=.env.local scripts/dev/multi-store-hold.mjs

import pg from "pg";

const BASE = "https://api-m.sandbox.paypal.com";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows: stores } = await db.query("select name, paypal_merchant_id as id from stores order by name");
await db.end();
if (stores.length < 2) throw new Error("need two stores");

const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const { access_token } = await tokenRes.json();

const unit = (ref, merchantId, value) => ({
  reference_id: ref,
  amount: { currency_code: "USD", value },
  payee: { merchant_id: merchantId },
});

async function attempt(label, intent, units) {
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
    body: JSON.stringify({
      intent,
      purchase_units: units,
      payment_source: {
        paypal: { experience_context: { return_url: "https://localhost/cosign/return", cancel_url: "https://localhost/cosign/cancel" } },
      },
    }),
  });
  const body = await res.json();
  const issue = body.details?.map((d) => `${d.issue}${d.field ? ` (${d.field})` : ""}`).join(", ");
  console.log(`\n${label}\n  HTTP ${res.status}${res.headers.get("paypal-debug-id") ? ` debug_id ${res.headers.get("paypal-debug-id")}` : ""}`);
  console.log(res.ok ? `  order ${body.id} status ${body.status}, units ${body.purchase_units?.length}` : `  ${body.name}: ${issue ?? body.message}`);
}

const [a, b] = stores;
await attempt(`1. AUTHORIZE, 2 units, different stores (${a.name} + ${b.name})`, "AUTHORIZE", [unit("s1", a.id, "10.00"), unit("s2", b.id, "10.00")]);
await attempt(`2. AUTHORIZE, 2 units, same store (${a.name} twice)`, "AUTHORIZE", [unit("s1", a.id, "10.00"), unit("s2", a.id, "10.00")]);
await attempt(`3. CAPTURE, 2 units, different stores (${a.name} + ${b.name})`, "CAPTURE", [unit("s1", a.id, "10.00"), unit("s2", b.id, "10.00")]);
await attempt(`4. Control: AUTHORIZE, 1 unit (${a.name})`, "AUTHORIZE", [unit("s1", a.id, "10.00")]);
