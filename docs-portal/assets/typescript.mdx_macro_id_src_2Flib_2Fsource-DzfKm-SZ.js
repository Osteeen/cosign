import{r as e}from"./rolldown-runtime-hePW80VL.js";import{t}from"./jsx-runtime-NZYk81nU.js";import{n,t as r}from"./server.browser-CRtpYEZZ.js";var i=e(t()),a={title:`TypeScript SDK`,description:`Install and start using the TypeScript SDK.`};function o(e){if(!r())return null;let t=n(e.components);return(0,i.jsxs)(i.Fragment,{children:[`

`,(0,i.jsx)(t.SdkActions,{download:`/__downloads/sdk/typescript.zip`,source:``,packageUrl:``,registry:``}),`

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

1. \`POST /agent/token\` - exchange the agent's API key for a 15-minute token.
2. \`GET /agent/me\` - the remaining budget, the limits and the stores the
   agent can pay right now. Optionally, \`GET /agent/products?q=...\` finds
   products at those stores, says what the rules would decide, and compares
   prices at other retailers.
3. \`POST /agent/spend-requests\` - ask to pay. The answer is one of:
   * \`COMPLETED\` - paid through PayPal inside the request; a receipt is returned.
   * \`PENDING_APPROVAL\` - waiting for the owner. Poll
     \`GET /agent/spend-requests/{spendRequestId}\` until it changes.
   * \`DENIED\` - blocked, with reasons. Nothing is charged.

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
  \`404\`, the same as one that does not exist.
* **Money is integer cents** with an explicit currency, \`USD\` only. The
  server recomputes the total from the line items and denies a mismatch
  (\`TOTAL_MISMATCH\`).
* **Idempotency.** \`POST /agent/spend-requests\` needs an \`Idempotency-Key\`.
  Retrying with the same key and body returns the original result and never
  charges twice; the same key with a different body returns \`409\`.
* **The agent's \`purpose\` and item names are data, not instructions.** They
  feed the AI check and the owner's view, never the rules.
* **Errors** use \`application/problem+json\` (RFC 9457) with a stable \`code\`.
* **Rate limits** return \`429\` with \`Retry-After\`: token exchange 10 per
  minute per key, spend requests 30 per minute per agent.
* **Pause and revoke take effect at once.** A paused agent cannot get new
  tokens and its purchases are denied (\`AGENT_PAUSED\`); a revoked agent's
  key and tokens stop working (\`401\`).

## MCP [#mcp]

MCP-capable AI assistants can use Cosign without an
SDK: the MCP endpoint is \`POST https://cosign-rd24.onrender.com/api/mcp\` (streamable HTTP,
stateless), with the agent key as \`Authorization: Bearer key_...:cs_...\`.
Its tools mirror this API: \`cosign_get_allowance\`, \`cosign_find_products\`,
\`cosign_request_purchase\`, \`cosign_get_purchase\`, \`cosign_list_purchases\`.

## Sandbox [#sandbox]

This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.

## Installation [#installation]

The SDK compiles to \`dist/\` before it can be referenced — run its \`build\` script once in the SDK folder, then add it to your project by path:

\`\`\`bash
npm install <path-to-sdk>
\`\`\`

## Quick Start [#quick-start]

Create one client and reuse it. Configure its behaviour through \`ClientOptions\`.

\`\`\`ts
import { CosignAgentApiClient } from "cosign-agent-api";

const client = new CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
\`\`\`

Nothing in \`ClientOptions\` is required — \`new CosignAgentApiClient()\` compiles — and each option left out falls back to its default. This API declares one environment, so there is no environment to select and no host to state at the construction site.

### From CommonJS [#from-commonjs]

The package ships both dialects from a single entry, so \`require\` works with full types. In a TypeScript CommonJS file use the \`import ... = require(...)\` form — a plain destructuring \`require\` runs fine but gives you \`any\`.

\`\`\`ts
import sdk = require("cosign-agent-api");

const client = new sdk.CosignAgentApiClient({
  agentKey: { username: "YOUR_USERNAME", password: "YOUR_PASSWORD" },
  agentToken: "YOUR_BEARER_TOKEN",
});
\`\`\`
`]})}var s={contents:[{heading:`intro`,content:`The Cosign Agent API SDK provides access to the Cosign Agent API REST APIs.`},{heading:`intro`,content:`Cosign is a company card for AI agents, built on PayPal. A person (the
**owner**) gives each agent a **permission slip**: a budget per period, a
per-purchase limit, an amount above which the owner must approve, and the
stores and categories it may buy from. The owner approves one PayPal budget
hold per store. When an agent asks to pay and the purchase fits the slip,
PayPal pays the store straight from that hold. Agents never see PayPal
credentials, and Cosign never holds funds.`},{heading:`intro`,content:`This API is what **agents** call. Owners use the Cosign web app.`},{heading:`the-whole-job-in-three-calls`,content:"`POST /agent/token` - exchange the agent's API key for a 15-minute token."},{heading:`the-whole-job-in-three-calls`,content:"`GET /agent/me` - the remaining budget, the limits and the stores the\nagent can pay right now. Optionally, `GET /agent/products?q=...` finds\nproducts at those stores, says what the rules would decide, and compares\nprices at other retailers."},{heading:`the-whole-job-in-three-calls`,content:"`POST /agent/spend-requests` - ask to pay. The answer is one of:"},{heading:`the-whole-job-in-three-calls`,content:"`COMPLETED` - paid through PayPal inside the request; a receipt is returned."},{heading:`the-whole-job-in-three-calls`,content:"`PENDING_APPROVAL` - waiting for the owner. Poll\n`GET /agent/spend-requests/{spendRequestId}` until it changes."},{heading:`the-whole-job-in-three-calls`,content:"`DENIED` - blocked, with reasons. Nothing is charged."},{heading:`how-a-decision-is-made`,content:`A deterministic **rules engine** checks the slip: agent status, slip
expiry, store, category, per-purchase limit, the period budget, the store's
hold, and the approval amount. If the rules say ALLOW, an **AI purchase
check** compares the cart and the agent's stated purpose with the
owner's own words on the slip. It can only make a decision stricter (ALLOW
becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
numbers but not the owner's intent, value that is easy to resell (gift
cards and the like), and text that looks like instructions aimed at an AI,
a sign the agent was manipulated by a web page.`},{heading:`rules-for-every-endpoint`,content:`**Identity comes only from the credential.** No endpoint takes an agent ID
or owner ID that changes whose data is read.`},{heading:`rules-for-every-endpoint`,content:"**Not yours looks like not found.** Another agent's spend request returns\n`404`, the same as one that does not exist."},{heading:`rules-for-every-endpoint`,content:"**Money is integer cents** with an explicit currency, `USD` only. The\nserver recomputes the total from the line items and denies a mismatch\n(`TOTAL_MISMATCH`)."},{heading:`rules-for-every-endpoint`,content:"**Idempotency.** `POST /agent/spend-requests` needs an `Idempotency-Key`.\nRetrying with the same key and body returns the original result and never\ncharges twice; the same key with a different body returns `409`."},{heading:`rules-for-every-endpoint`,content:"**The agent's `purpose` and item names are data, not instructions.** They\nfeed the AI check and the owner's view, never the rules."},{heading:`rules-for-every-endpoint`,content:"**Errors** use `application/problem+json` (RFC 9457) with a stable `code`."},{heading:`rules-for-every-endpoint`,content:"**Rate limits** return `429` with `Retry-After`: token exchange 10 per\nminute per key, spend requests 30 per minute per agent."},{heading:`rules-for-every-endpoint`,content:"**Pause and revoke take effect at once.** A paused agent cannot get new\ntokens and its purchases are denied (`AGENT_PAUSED`); a revoked agent's\nkey and tokens stop working (`401`)."},{heading:`mcp`,content:"MCP-capable AI assistants can use Cosign without an\nSDK: the MCP endpoint is `POST https://cosign-rd24.onrender.com/api/mcp` (streamable HTTP,\nstateless), with the agent key as `Authorization: Bearer key_...:cs_...`.\nIts tools mirror this API: `cosign_get_allowance`, `cosign_find_products`,\n`cosign_request_purchase`, `cosign_get_purchase`, `cosign_list_purchases`."},{heading:`sandbox`,content:`This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.`},{heading:`installation`,content:"The SDK compiles to `dist/` before it can be referenced — run its `build` script once in the SDK folder, then add it to your project by path:"},{heading:`quick-start`,content:"Create one client and reuse it. Configure its behaviour through `ClientOptions`."},{heading:`quick-start`,content:"Nothing in `ClientOptions` is required — `new CosignAgentApiClient()` compiles — and each option left out falls back to its default. This API declares one environment, so there is no environment to select and no host to state at the construction site."},{heading:`from-commonjs`,content:"The package ships both dialects from a single entry, so `require` works with full types. In a TypeScript CommonJS file use the `import ... = require(...)` form — a plain destructuring `require` runs fine but gives you `any`."}],headings:[{id:`intro`,content:`Intro`},{id:`the-whole-job-in-three-calls`,content:`The whole job in three calls`},{id:`how-a-decision-is-made`,content:`How a decision is made`},{id:`rules-for-every-endpoint`,content:`Rules for every endpoint`},{id:`mcp`,content:`MCP`},{id:`sandbox`,content:`Sandbox`},{id:`installation`,content:`Installation`},{id:`quick-start`,content:`Quick Start`},{id:`from-commonjs`,content:`From CommonJS`}]},c=[{depth:2,url:`#intro`,title:(0,i.jsx)(i.Fragment,{children:`Intro`})},{depth:2,url:`#the-whole-job-in-three-calls`,title:(0,i.jsx)(i.Fragment,{children:`The whole job in three calls`})},{depth:2,url:`#how-a-decision-is-made`,title:(0,i.jsx)(i.Fragment,{children:`How a decision is made`})},{depth:2,url:`#rules-for-every-endpoint`,title:(0,i.jsx)(i.Fragment,{children:`Rules for every endpoint`})},{depth:2,url:`#mcp`,title:(0,i.jsx)(i.Fragment,{children:`MCP`})},{depth:2,url:`#sandbox`,title:(0,i.jsx)(i.Fragment,{children:`Sandbox`})},{depth:2,url:`#installation`,title:(0,i.jsx)(i.Fragment,{children:`Installation`})},{depth:2,url:`#quick-start`,title:(0,i.jsx)(i.Fragment,{children:`Quick Start`})},{depth:3,url:`#from-commonjs`,title:(0,i.jsx)(i.Fragment,{children:`From CommonJS`})}];function l(e){let t={code:`code`,h2:`h2`,h3:`h3`,li:`li`,ol:`ol`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components},{SdkActions:n}=t;return n||d(`SdkActions`,!0),(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n,{download:`/__downloads/sdk/typescript.zip`,source:``,packageUrl:``,registry:``}),`
`,(0,i.jsx)(t.h2,{id:`intro`,children:`Intro`}),`
`,(0,i.jsx)(t.p,{children:`The Cosign Agent API SDK provides access to the Cosign Agent API REST APIs.`}),`
`,(0,i.jsxs)(t.p,{children:[`Cosign is a company card for AI agents, built on PayPal. A person (the
`,(0,i.jsx)(t.strong,{children:`owner`}),`) gives each agent a `,(0,i.jsx)(t.strong,{children:`permission slip`}),`: a budget per period, a
per-purchase limit, an amount above which the owner must approve, and the
stores and categories it may buy from. The owner approves one PayPal budget
hold per store. When an agent asks to pay and the purchase fits the slip,
PayPal pays the store straight from that hold. Agents never see PayPal
credentials, and Cosign never holds funds.`]}),`
`,(0,i.jsxs)(t.p,{children:[`This API is what `,(0,i.jsx)(t.strong,{children:`agents`}),` call. Owners use the Cosign web app.`]}),`
`,(0,i.jsx)(t.h2,{id:`the-whole-job-in-three-calls`,children:`The whole job in three calls`}),`
`,(0,i.jsxs)(t.ol,{children:[`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`POST /agent/token`}),` - exchange the agent's API key for a 15-minute token.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`GET /agent/me`}),` - the remaining budget, the limits and the stores the
agent can pay right now. Optionally, `,(0,i.jsx)(t.code,{children:`GET /agent/products?q=...`}),` finds
products at those stores, says what the rules would decide, and compares
prices at other retailers.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`POST /agent/spend-requests`}),` - ask to pay. The answer is one of:
`,(0,i.jsxs)(t.ul,{children:[`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`COMPLETED`}),` - paid through PayPal inside the request; a receipt is returned.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`PENDING_APPROVAL`}),` - waiting for the owner. Poll
`,(0,i.jsx)(t.code,{children:`GET /agent/spend-requests/{spendRequestId}`}),` until it changes.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.code,{children:`DENIED`}),` - blocked, with reasons. Nothing is charged.`]}),`
`]}),`
`]}),`
`]}),`
`,(0,i.jsx)(t.h2,{id:`how-a-decision-is-made`,children:`How a decision is made`}),`
`,(0,i.jsxs)(t.p,{children:[`A deterministic `,(0,i.jsx)(t.strong,{children:`rules engine`}),` checks the slip: agent status, slip
expiry, store, category, per-purchase limit, the period budget, the store's
hold, and the approval amount. If the rules say ALLOW, an `,(0,i.jsx)(t.strong,{children:`AI purchase
check`}),` compares the cart and the agent's stated purpose with the
owner's own words on the slip. It can only make a decision stricter (ALLOW
becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
numbers but not the owner's intent, value that is easy to resell (gift
cards and the like), and text that looks like instructions aimed at an AI,
a sign the agent was manipulated by a web page.`]}),`
`,(0,i.jsx)(t.h2,{id:`rules-for-every-endpoint`,children:`Rules for every endpoint`}),`
`,(0,i.jsxs)(t.ul,{children:[`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Identity comes only from the credential.`}),` No endpoint takes an agent ID
or owner ID that changes whose data is read.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Not yours looks like not found.`}),` Another agent's spend request returns
`,(0,i.jsx)(t.code,{children:`404`}),`, the same as one that does not exist.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Money is integer cents`}),` with an explicit currency, `,(0,i.jsx)(t.code,{children:`USD`}),` only. The
server recomputes the total from the line items and denies a mismatch
(`,(0,i.jsx)(t.code,{children:`TOTAL_MISMATCH`}),`).`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Idempotency.`}),` `,(0,i.jsx)(t.code,{children:`POST /agent/spend-requests`}),` needs an `,(0,i.jsx)(t.code,{children:`Idempotency-Key`}),`.
Retrying with the same key and body returns the original result and never
charges twice; the same key with a different body returns `,(0,i.jsx)(t.code,{children:`409`}),`.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsxs)(t.strong,{children:[`The agent's `,(0,i.jsx)(t.code,{children:`purpose`}),` and item names are data, not instructions.`]}),` They
feed the AI check and the owner's view, never the rules.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Errors`}),` use `,(0,i.jsx)(t.code,{children:`application/problem+json`}),` (RFC 9457) with a stable `,(0,i.jsx)(t.code,{children:`code`}),`.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Rate limits`}),` return `,(0,i.jsx)(t.code,{children:`429`}),` with `,(0,i.jsx)(t.code,{children:`Retry-After`}),`: token exchange 10 per
minute per key, spend requests 30 per minute per agent.`]}),`
`,(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:`Pause and revoke take effect at once.`}),` A paused agent cannot get new
tokens and its purchases are denied (`,(0,i.jsx)(t.code,{children:`AGENT_PAUSED`}),`); a revoked agent's
key and tokens stop working (`,(0,i.jsx)(t.code,{children:`401`}),`).`]}),`
`]}),`
`,(0,i.jsx)(t.h2,{id:`mcp`,children:`MCP`}),`
`,(0,i.jsxs)(t.p,{children:[`MCP-capable AI assistants can use Cosign without an
SDK: the MCP endpoint is `,(0,i.jsx)(t.code,{children:`POST https://cosign-rd24.onrender.com/api/mcp`}),` (streamable HTTP,
stateless), with the agent key as `,(0,i.jsx)(t.code,{children:`Authorization: Bearer key_...:cs_...`}),`.
Its tools mirror this API: `,(0,i.jsx)(t.code,{children:`cosign_get_allowance`}),`, `,(0,i.jsx)(t.code,{children:`cosign_find_products`}),`,
`,(0,i.jsx)(t.code,{children:`cosign_request_purchase`}),`, `,(0,i.jsx)(t.code,{children:`cosign_get_purchase`}),`, `,(0,i.jsx)(t.code,{children:`cosign_list_purchases`}),`.`]}),`
`,(0,i.jsx)(t.h2,{id:`sandbox`,children:`Sandbox`}),`
`,(0,i.jsx)(t.p,{children:`This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.`}),`
`,(0,i.jsx)(t.h2,{id:`installation`,children:`Installation`}),`
`,(0,i.jsxs)(t.p,{children:[`The SDK compiles to `,(0,i.jsx)(t.code,{children:`dist/`}),` before it can be referenced — run its `,(0,i.jsx)(t.code,{children:`build`}),` script once in the SDK folder, then add it to your project by path:`]}),`
`,(0,i.jsx)(i.Fragment,{children:(0,i.jsx)(t.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,title:`Terminal`,children:(0,i.jsx)(t.code,{children:(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#6F42C1`,"--shiki-dark":`#B392F0`},children:`npm`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:` install`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` <`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`path-to-sd`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`k`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`>`})]})})})}),`
`,(0,i.jsx)(t.h2,{id:`quick-start`,children:`Quick Start`}),`
`,(0,i.jsxs)(t.p,{children:[`Create one client and reuse it. Configure its behaviour through `,(0,i.jsx)(t.code,{children:`ClientOptions`}),`.`]}),`
`,(0,i.jsx)(i.Fragment,{children:(0,i.jsx)(t.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,title:`TypeScript`,children:(0,i.jsxs)(t.code,{children:[(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`import`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:` { CosignAgentApiClient } `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`from`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:` "cosign-agent-api"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`;`})]}),`
`,(0,i.jsx)(t.span,{className:`line`}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`const`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#005CC5`,"--shiki-dark":`#79B8FF`},children:` client`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` =`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` new`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#6F42C1`,"--shiki-dark":`#B392F0`},children:` CosignAgentApiClient`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`({`})]}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`  agentKey: { username: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_USERNAME"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`, password: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_PASSWORD"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:` },`})]}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`  agentToken: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_BEARER_TOKEN"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`,`})]}),`
`,(0,i.jsx)(t.span,{className:`line`,children:(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`});`})})]})})}),`
`,(0,i.jsxs)(t.p,{children:[`Nothing in `,(0,i.jsx)(t.code,{children:`ClientOptions`}),` is required — `,(0,i.jsx)(t.code,{children:`new CosignAgentApiClient()`}),` compiles — and each option left out falls back to its default. This API declares one environment, so there is no environment to select and no host to state at the construction site.`]}),`
`,(0,i.jsx)(t.h3,{id:`from-commonjs`,children:`From CommonJS`}),`
`,(0,i.jsxs)(t.p,{children:[`The package ships both dialects from a single entry, so `,(0,i.jsx)(t.code,{children:`require`}),` works with full types. In a TypeScript CommonJS file use the `,(0,i.jsx)(t.code,{children:`import ... = require(...)`}),` form — a plain destructuring `,(0,i.jsx)(t.code,{children:`require`}),` runs fine but gives you `,(0,i.jsx)(t.code,{children:`any`}),`.`]}),`
`,(0,i.jsx)(i.Fragment,{children:(0,i.jsx)(t.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,title:`TypeScript`,children:(0,i.jsxs)(t.code,{children:[(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`import`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:` sdk `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`=`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` require`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`(`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"cosign-agent-api"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`);`})]}),`
`,(0,i.jsx)(t.span,{className:`line`}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:`const`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#005CC5`,"--shiki-dark":`#79B8FF`},children:` client`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` =`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#D73A49`,"--shiki-dark":`#F97583`},children:` new`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:` sdk.`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#6F42C1`,"--shiki-dark":`#B392F0`},children:`CosignAgentApiClient`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`({`})]}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`  agentKey: { username: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_USERNAME"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`, password: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_PASSWORD"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:` },`})]}),`
`,(0,i.jsxs)(t.span,{className:`line`,children:[(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`  agentToken: `}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`"YOUR_BEARER_TOKEN"`}),(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`,`})]}),`
`,(0,i.jsx)(t.span,{className:`line`,children:(0,i.jsx)(t.span,{style:{"--shiki-light":`#24292E`,"--shiki-dark":`#E1E4E8`},children:`});`})})]})})})]})}function u(e={}){let{wrapper:t}=e.components||{};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}function d(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}export{o as _markdown,u as default,a as frontmatter,s as structuredData,c as toc};