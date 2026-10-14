# TypeScript SDK (/sdks/typescript)

[Download SDK](/__downloads/sdk/typescript.zip)

## Intro [#intro]

The Cosign Agent API SDK provides access to the Cosign Agent API REST APIs.

Cosign is a company card for AI agents, built on PayPal. A person (the
**owner**) gives each agent a **permission slip**: a budget per period, a
per-purchase limit, an amount above which the owner must approve, and the
stores and categories it may buy from. The owner approves one PayPal budget
hold per store. When an agent asks to pay and the purchase fits the slip,
PayPal pays the store straight from that hold. Agents never see PayPal
credentials, and Cosign never holds funds.

This API is what **agents** call. Owners use the Cosign web app.

## The whole job in three calls [#the-whole-job-in-three-calls]

1. `POST /agent/token` - exchange the agent's API key for a 15-minute token.
2. `GET /agent/me` - the remaining budget, the limits and the stores the
   agent can pay right now. Optionally, `GET /agent/products?q=...` finds
   products at those stores, says what the rules would decide, and compares
   prices at other retailers.
3. `POST /agent/spend-requests` - ask to pay. The answer is one of:
   * `COMPLETED` - paid through PayPal inside the request; a receipt is returned.
   * `PENDING_APPROVAL` - waiting for the owner. Poll
     `GET /agent/spend-requests/{spendRequestId}` until it changes.
   * `DENIED` - blocked, with reasons. Nothing is charged.

## How a decision is made [#how-a-decision-is-made]

A deterministic **rules engine** checks the slip: agent status, slip
expiry, store, category, per-purchase limit, the period budget, the store's
hold, and the approval amount. If the rules say ALLOW, an **AI purchase
check** compares the cart and the agent's stated purpose with the
owner's own words on the slip. It can only make a decision stricter (ALLOW
becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
numbers but not the owner's intent, value that is easy to resell (gift
cards and the like), and text that looks like instructions aimed at an AI,
a sign the agent was manipulated by a web page.

## Rules for every endpoint [#rules-for-every-endpoint]

* **Identity comes only from the credential.** No endpoint takes an agent ID
  or owner ID that changes whose data is read.
* **Not yours looks like not found.** Another agent's spend request returns
  `404`, the same as one that does not exist.
* **Money is integer cents** with an explicit currency, `USD` only. The
  server recomputes the total from the line items and denies a mismatch
  (`TOTAL_MISMATCH`).
* **Idempotency.** `POST /agent/spend-requests` needs an `Idempotency-Key`.
  Retrying with the same key and body returns the original result and never
  charges twice; the same key with a different body returns `409`.
* **The agent's `purpose` and item names are data, not instructions.** They
  feed the AI check and the owner's view, never the rules.
* **Errors** use `application/problem+json` (RFC 9457) with a stable `code`.
* **Rate limits** return `429` with `Retry-After`: token exchange 10 per
  minute per key, spend requests 30 per minute per agent.
* **Pause and revoke take effect at once.** A paused agent cannot get new
  tokens and its purchases are denied (`AGENT_PAUSED`); a revoked agent's
  key and tokens stop working (`401`).

## MCP [#mcp]

MCP-capable AI assistants can use Cosign without an
SDK: the MCP endpoint is `POST https://cosign-rd24.onrender.com/api/mcp` (streamable HTTP,
stateless), with the agent key as `Authorization: Bearer key_...:cs_...`.
Its tools mirror this API: `cosign_get_allowance`, `cosign_find_products`,
`cosign_request_purchase`, `cosign_get_purchase`, `cosign_list_purchases`.

## Sandbox [#sandbox]

This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.

## Installation [#installation]

The SDK compiles to `dist/` before it can be referenced — run its `build` script once in the SDK folder, then add it to your project by path:

```bash
npm install <path-to-sdk>
```

## Quick Start [#quick-start]

Create one client and reuse it. Configure its behaviour through `ClientOptions`.

```ts
import { CosignAgentApiClient } from "cosign-agent-api";

const client = new CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
```

Nothing in `ClientOptions` is required — `new CosignAgentApiClient()` compiles — and each option left out falls back to its default. This API declares one environment, so there is no environment to select and no host to state at the construction site.

### From CommonJS [#from-commonjs]

The package ships both dialects from a single entry, so `require` works with full types. In a TypeScript CommonJS file use the `import ... = require(...)` form — a plain destructuring `require` runs fine but gives you `any`.

```ts
import sdk = require("cosign-agent-api");

const client = new sdk.CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
```