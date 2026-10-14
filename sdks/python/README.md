# Cosign Agent API SDK

[![Built with APIMatic][apimatic-badge]][apimatic-url] [![License: MIT][license-badge]][license-url] [![Python 3.10+][python-badge]][python-url]

The Cosign Agent API SDK for Python provides access to the Cosign Agent API REST APIs from Python applications.

> [!TIP]
> **Looking for a specific signature, model, enum, or error type?** This SDK ships a generated
> **[SDK map](sdk-map.md)** -- a lookup index of the SDK's entire Python surface. Consult it before
> scanning the source tree; details under [SDK map](#sdk-map).

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
   agent can pay right now.
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
Its tools mirror this API: `cosign_get_allowance`,
`cosign_request_purchase`, `cosign_get_purchase`, `cosign_list_purchases`.

## Sandbox

This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.


---

## Installation

Add the Python SDK to your project from its folder, with whichever package manager your project uses. Give each tool a path containing a slash, such as `../cosign-agent-api` — a bare folder name is looked up on PyPI instead, and resolves to whatever project holds that name there:

```bash
pip install <path-to-sdk>
```

```bash
uv add <path-to-sdk>
```

```bash
poetry add <path-to-sdk>
```

---

## Quick Start

### Synchronous client

Construct `CosignAgentApiClient` with keyword arguments, and call `close()` when you are done. Every argument is optional; the full list is in the [SDK map](sdk-map.md).

```python
from cosign_agent_api import CosignAgentApiClient
from cosign_agent_api.core import BasicAuthCredentials

client = CosignAgentApiClient(
    agent_key=BasicAuthCredentials(username="YOUR_USERNAME", password="YOUR_PASSWORD"), agent_token="YOUR_BEARER_TOKEN"
)

# TODO: call endpoints here -- see api-reference.md

client.close()
```

Alternatively, scope it -- `with CosignAgentApiClient(...) as client:` closes the pool on exit; see [Best Practices](#best-practices).

`Client` is exported as an alias of `CosignAgentApiClient`, so `from cosign_agent_api import Client` also works.

The SDK accepts every model-typed input in two interchangeable spellings, both type-checked: the typed model, or a plain dict with the same keys -- the `OrDict` and `Model | ModelDict` unions in the [SDK map](sdk-map.md). Pick whichever suits the call site: the dict form needs no import, while the model form adds a keyword-checked constructor and editor completion.

### Asynchronous client

`AsyncCosignAgentApiClient` mirrors `CosignAgentApiClient` with **identical method names**, and every endpoint method is a coroutine. It takes the same arguments, with some differences -- for example, the transport argument is `custom_async_http_client`.

```python
from asyncio import run

from cosign_agent_api import AsyncCosignAgentApiClient
from cosign_agent_api.core import BasicAuthCredentials


async def main() -> None:
    client = AsyncCosignAgentApiClient(
        agent_key=BasicAuthCredentials(username="YOUR_USERNAME", password="YOUR_PASSWORD"),
        agent_token="YOUR_BEARER_TOKEN",
    )
    # TODO: call endpoints here, awaiting each -- see api-reference.md
    await client.aclose()


run(main())
```

Alternatively, scope it -- `async with AsyncCosignAgentApiClient(...) as client:` closes the pool on exit. Only the async spelling is `aclose`, matching httpx2; see [Best Practices](#best-practices).

`AsyncClient` is the exported alias. Each client accepts **only** its own transport argument; passing the other's is a `TypeError` at runtime and an error under mypy.

---

## Usage

Two generated references cover the SDK; each answers a different question:

| Reference | For |
| --- | --- |
| **[API Reference](api-reference.md)** | Usage guidance for a single **parsed** operation: `client.<group>.<operation>(...)` returns the typed payload and raises `ApiError` on any non-2xx, with `.error` the typed error body, or `RawError` for a status the operation does not document. |
| **[Raw API Reference](raw-api-reference.md)** | The same for the **raw** variant: `client.<group>.with_raw_response.<operation>(...)` returns `ApiResult[T, E]` and never raises for an API error. |

Both API references carry every one of the 5 operations, with a sync and an async sample and a parameter table each.

## SDK map

This SDK ships a generated **SDK map** -- [`sdk-map.md`](sdk-map.md) -- a deterministic, lookup-oriented table of contents of the SDK's Python surface, generated by APIMatic alongside this SDK.

Consult the map before scanning or grepping the source: it answers call-level contract questions by lookup, and for anything it does not carry -- model shapes, enum values, an endpoint's route or behavioural prose -- it names the one source file to read. How to read the map itself, including the SDK-wide defaults its rows rely on, is stated at the top of [`sdk-map.md`](sdk-map.md).

## Best Practices

> [!TIP]
> Use a **single `CosignAgentApiClient` instance** for the lifetime of your application and reuse it across
> all requests. Each instance owns its own connection pool, so an instance per request forfeits
> connection reuse and leaks pools that are never closed.

Match the disposal to the client's lifetime: an application-lifetime client is closed once at shutdown with `close()` / `aclose()`; where the lifetime fits a block, `with CosignAgentApiClient() as client:` / `async with AsyncCosignAgentApiClient() as client:` releases it automatically. Both are idempotent, but a closed client is not reusable: the next call raises. The client closes **whatever transport it holds**, including one you supplied via `custom_http_client` / `custom_async_http_client`; if you intend to reuse your own transport across clients, don't hand its lifetime to a `with` block.

**Retries are on by default**: a failed idempotent request — a retryable status or no response at all — is sent again up to three times before the call gives up. Pass `retry_options=0` to turn it off, for instance in a test that stubs an error response; the policy and its defaults are under **Retries** in the SDK map.

## License

This SDK is distributed under the [MIT License][license-url].

---

## Support

Refer to the [API reference](api-reference.md) for detailed information on available operations with code samples.

---

[license-url]: LICENSE
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg
[apimatic-url]: https://www.apimatic.io
[apimatic-badge]: https://www.apimatic.io/hubfs/Built-with-APIMatic-badge.svg
[python-url]: https://www.python.org/downloads/
[python-badge]: https://img.shields.io/badge/python-3.10%2B-blue.svg
