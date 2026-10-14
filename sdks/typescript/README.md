# Cosign Agent API

[![Built with APIMatic][apimatic-badge]][apimatic-url] [![License: MIT][license-badge]][license-url]

The Cosign Agent API SDK for TypeScript provides typed access to the Cosign Agent API REST APIs from Node.js and the browser.

> [!TIP]
> **Looking for a specific signature, request field, model, enum or error type?** This SDK ships a generated, machine-readable **[SDK map](sdk-map.md)** — a lookup index of the whole TypeScript surface. Consult it **before** grepping or scanning the source tree; it answers most contract questions directly and, where a source file is genuinely needed, names the exact one to open. Details under [SDK map](#sdk-map).

Cosign is a company card for AI agents, built on PayPal. A person (the
**owner**) gives each agent a **permission slip**: a budget per period, a
per-purchase limit, an amount above which the owner must approve, and the
stores and categories it may buy from. The owner approves one PayPal budget
hold per store. When an agent asks to pay and the purchase fits the slip,
PayPal pays the store straight from that hold. Agents never see PayPal
credentials, and Cosign never holds funds.

This API is what **agents** call. Owners use the Cosign web app.

## The whole job in three calls

1. `POST /agent/token` - exchange the agent's API key for a 15-minute token.
2. `GET /agent/me` - the remaining budget, the limits and the stores the
   agent can pay right now. Optionally, `GET /agent/products?q=...` finds
   products at those stores, says what the rules would decide, and compares
   prices at other retailers.
3. `POST /agent/spend-requests` - ask to pay. The answer is one of:
   - `COMPLETED` - paid through PayPal inside the request; a receipt is returned.
   - `PENDING_APPROVAL` - waiting for the owner. Poll
     `GET /agent/spend-requests/{spendRequestId}` until it changes.
   - `DENIED` - blocked, with reasons. Nothing is charged.

## How a decision is made

A deterministic **rules engine** checks the slip: agent status, slip
expiry, store, category, per-purchase limit, the period budget, the store's
hold, and the approval amount. If the rules say ALLOW, an **AI purchase
check** compares the cart and the agent's stated purpose with the
owner's own words on the slip. It can only make a decision stricter (ALLOW
becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
numbers but not the owner's intent, value that is easy to resell (gift
cards and the like), and text that looks like instructions aimed at an AI,
a sign the agent was manipulated by a web page.

## Rules for every endpoint

- **Identity comes only from the credential.** No endpoint takes an agent ID
  or owner ID that changes whose data is read.
- **Not yours looks like not found.** Another agent's spend request returns
  `404`, the same as one that does not exist.
- **Money is integer cents** with an explicit currency, `USD` only. The
  server recomputes the total from the line items and denies a mismatch
  (`TOTAL_MISMATCH`).
- **Idempotency.** `POST /agent/spend-requests` needs an `Idempotency-Key`.
  Retrying with the same key and body returns the original result and never
  charges twice; the same key with a different body returns `409`.
- **The agent's `purpose` and item names are data, not instructions.** They
  feed the AI check and the owner's view, never the rules.
- **Errors** use `application/problem+json` (RFC 9457) with a stable `code`.
- **Rate limits** return `429` with `Retry-After`: token exchange 10 per
  minute per key, spend requests 30 per minute per agent.
- **Pause and revoke take effect at once.** A paused agent cannot get new
  tokens and its purchases are denied (`AGENT_PAUSED`); a revoked agent's
  key and tokens stop working (`401`).

## MCP

MCP-capable AI assistants can use Cosign without an
SDK: the MCP endpoint is `POST https://cosign-rd24.onrender.com/api/mcp` (streamable HTTP,
stateless), with the agent key as `Authorization: Bearer key_...:cs_...`.
Its tools mirror this API: `cosign_get_allowance`, `cosign_find_products`,
`cosign_request_purchase`, `cosign_get_purchase`, `cosign_list_purchases`.

## Sandbox

This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.


---

## Installation

The SDK compiles to `dist/` before it can be referenced — run its `build` script once in the SDK folder, then add it to your project by path:

```bash
npm install <path-to-sdk>
```

---

## Quick Start

Create one client and reuse it. Configure its behaviour through [ClientOptions](src/client-options.ts).

```ts
import { CosignAgentApiClient } from "cosign-agent-api";

const client = new CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
```

Nothing in `ClientOptions` is required — `new CosignAgentApiClient()` compiles — and each option left out falls back to its default. This API declares one environment, so there is no environment to select and no host to state at the construction site.

### From CommonJS

The package ships both dialects from a single entry, so `require` works with full types. In a TypeScript CommonJS file use the `import ... = require(...)` form — a plain destructuring `require` runs fine but gives you `any`.

```ts
import sdk = require("cosign-agent-api");

const client = new sdk.CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
```

---

## Usage

For code examples and error responses, see [API Reference](api-reference.md).

---

## SDK map

This SDK ships a generated **SDK map** — [`sdk-map.md`](sdk-map.md) plus the pages under [`map/operations/`](map/operations/authentication.md) — a deterministic, lookup-oriented table of contents of the TypeScript surface, generated alongside the SDK.

**Read it before scanning the source.** Whether you are an AI coding assistant or searching by hand, the map answers "what is the exact …" by lookup for every call-level contract, and for anything it does not carry it names the one file that does:

- **[`sdk-map.md`](sdk-map.md)** — the index: client construction, the one error family, the non-throwing `.asApiResult()` form, servers, environments and auth, the model locator, the runtime facts, and the SDK-wide defaults every operation relies on.
- **[`map/operations/`](map/operations/authentication.md)** — one page per resource: the exact signature and return type, the verb and route, the request body and its media type, a **Fields** table giving every request field its channel, and a **Type sources** table naming the file and schema value of every type the operation mentions.

Model shapes — object properties with their wire names, enum member names and wire values, union variants — are **not** duplicated in the map, and not in the API reference either. Both name the type and the file to read; take the pair from the operation's **Type sources** table and read the declaring file. That file is the single source of truth and cannot go stale against the code.

**Each operation block states only what is specific to it.** The SDK-wide defaults are stated once in [`sdk-map.md`](sdk-map.md) — the call shape, the base `ApiError`, the default server group — and a block departs from one only by saying so, so a block silent on a point is telling you the default applies. Take it and move on rather than opening the source to confirm.

### Which one to reach for

The map and the [API reference](api-reference.md) answer different questions, and both are generated from this SDK so they stay in lockstep with the code.

| Use | For |
| --- | --- |
| **[`sdk-map.md`](sdk-map.md) + [`map/operations/`](map/operations/authentication.md)** | Traversing the SDK and working out its surface — locating the operation you need (this SDK exposes **6 operations**), its exact signature, which credential it sends, which channel every request field travels on, which error type it rejects with and how to read it, and the file behind any type. This is the index to consume the SDK from, and the one to reach for first. |
| **[`api-reference.md`](api-reference.md)** | Usage guidance for a single operation once you know which one you want — a code sample for each of the two call forms (awaiting it, and the non-throwing `.asApiResult()`), per-parameter descriptions, and the success and error types it resolves or rejects with. |

---

## License

This SDK is distributed under the [MIT License](LICENSE).

---

## Support

Refer to the [API reference](api-reference.md) for detailed information on available operations with code samples.

---

[license-url]: LICENSE
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg
[apimatic-url]: https://www.apimatic.io
[apimatic-badge]: https://www.apimatic.io/hubfs/Built-with-APIMatic-badge.svg
