// DEV ONLY: acts as an AI agent against the local Cosign API.
//   node scripts/dev/demo-agent.mjs <key-file> me
//   node scripts/dev/demo-agent.mjs <key-file> buy <store-id> <category> <qty> <unit-cents> "<item name>" "<purpose>" [idempotency-key]
// Never prints the key or the token.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.COSIGN_URL ?? "http://localhost:3001";
const [keyFile, cmd, ...args] = process.argv.slice(2);
const key = readFileSync(keyFile, "utf8").trim();

async function token() {
  const res = await fetch(`${BASE}/api/v1/agent/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(key).toString("base64")}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token: HTTP ${res.status} ${body.code}: ${body.detail}`);
  return body.access_token;
}

const show = (label, status, body) => {
  console.log(`\n${label}: HTTP ${status}`);
  console.log(JSON.stringify(body, null, 2));
};

const t = await token();
const auth = { Authorization: `Bearer ${t}` };

if (cmd === "me") {
  const res = await fetch(`${BASE}/api/v1/agent/me`, { headers: auth });
  show("allowance", res.status, await res.json());
} else if (cmd === "buy") {
  const [storeId, category, qty, unitCents, name, purpose, idem] = args;
  const quantity = Number(qty);
  const unit = Number(unitCents);
  const body = {
    store_id: storeId,
    items: [{ name, category, quantity, unit_amount_cents: unit }],
    total: { amount_cents: quantity * unit, currency: "USD" },
    purpose,
  };
  const res = await fetch(`${BASE}/api/v1/agent/spend-requests`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": idem ?? `demo-${randomUUID()}` },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  show("spend request", res.status, { status: out.status, outcome: out.decision?.outcome, reasons: out.decision?.reasons, total: out.total, receipt: out.receipt, code: out.code, detail: out.detail });
} else {
  console.error("commands: me | buy");
  process.exit(1);
}
