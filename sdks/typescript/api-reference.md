# Reference

> Source: [CosignAgentApiClient](src/client.ts)

## Authentication

> Source: [Authentication](src/resources/authentication.ts)

<details>
<summary><code>createToken(options?: RequestOptions): ApiPromise&lt;AgentToken, Authentication.CreateTokenError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Send the agent's API key with HTTP Basic auth. The key looks like
`key_<24 hex>:cs_<secret>`: the part before the colon is the username,
the part after is the password. The owner sees the key once, when the
agent is added.

Tokens last 15 minutes (`expires_in: 900`). Get a new one when a call
returns `401`. A paused or revoked agent cannot get a token.


</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.authentication.createToken();
  // TODO: Handle 'response' of type AgentToken
} catch (err) {
  // TODO: Handle 'err' of type Authentication.CreateTokenError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.authentication.createToken().asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type AgentToken
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.authentication.createToken()`

- **OnSuccess**: <code>[AgentToken](src/models/agent-token.ts)</code>
- **OnError**: throws <code>[Authentication.CreateTokenError](src/resources/authentication.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.authentication.createToken().asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;AgentToken, Authentication.CreateTokenError&gt;</code>, with `result.value` of type <code>[AgentToken](src/models/agent-token.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[CosignAgentApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

## Agent

> Source: [Agent](src/resources/agent.ts)

<details>
<summary><code>getAllowance(options?: RequestOptions): ApiPromise&lt;Allowance, Agent.GetAllowanceError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

The agent's active permission slip: what is left this period, the
limits, the allowed categories, and the stores it can pay right now
(only stores whose PayPal budget hold the owner has approved). Call this
before planning a purchase. `slip` is `null` when the agent has no
active slip yet.


</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.agent.getAllowance();
  // TODO: Handle 'response' of type Allowance
} catch (err) {
  // TODO: Handle 'err' of type Agent.GetAllowanceError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.agent.getAllowance().asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type Allowance
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.agent.getAllowance()`

- **OnSuccess**: <code>[Allowance](src/models/allowance.ts)</code>
- **OnError**: throws <code>[Agent.GetAllowanceError](src/resources/agent.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.agent.getAllowance().asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;Allowance, Agent.GetAllowanceError&gt;</code>, with `result.value` of type <code>[Allowance](src/models/allowance.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[CosignAgentApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

## SpendRequests

> Source: [SpendRequests](src/resources/spend-requests.ts)

<details>
<summary><code>createSpendRequest(request: SpendRequests.CreateSpendRequestRequest, options?: RequestOptions): ApiPromise&lt;SpendRequest, SpendRequests.CreateSpendRequestError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Cosign checks the purchase against the slip and answers inside this
request:

- **Paid** (`status: COMPLETED`) - the rules allowed it and the AI check
  raised nothing. PayPal captured the total from the store's budget
  hold; `receipt` is filled in.
- **Waiting for the owner** (`status: PENDING_APPROVAL`) - over the
  owner's approval amount, or flagged by the AI check. The owner is
  emailed. Poll `GET /agent/spend-requests/{spendRequestId}`; the owner
  approves the exact cart (then it is paid), declines it, or lets it
  expire after 24 hours.
- **Blocked** (`status: DENIED`) - see `decision.reasons`. Nothing is charged.

If PayPal does not answer in time the request stays `PROCESSING`;
poll it, and Cosign finishes the capture with the same PayPal request
ID, so it is never charged twice.


</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.spendRequests.createSpendRequest({
    idempotencyKey: "6f1d2c3b-4a5e-4f60-8172-9a0b1c2d3e4f",
    body: {
      storeId: "7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d",
      items: [
        {
          name: "Copy paper, letter, 500 sheets",
          category: Category.OfficeSupplies,
          quantity: 2,
          unitAmountCents: 649,
          productUrl: "http://localhost:3001/shop/paper-co/copy-paper-ream",
        },
      ],
      total: { amountCents: 1298 },
      purpose: "Restock printer paper for the office.",
    },
  });
  // TODO: Handle 'response' of type SpendRequest
} catch (err) {
  // TODO: Handle 'err' of type SpendRequests.CreateSpendRequestError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.spendRequests.createSpendRequest({
  idempotencyKey: "6f1d2c3b-4a5e-4f60-8172-9a0b1c2d3e4f",
  body: {
    storeId: "7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d",
    items: [
      {
        name: "Copy paper, letter, 500 sheets",
        category: Category.OfficeSupplies,
        quantity: 2,
        unitAmountCents: 649,
        productUrl: "http://localhost:3001/shop/paper-co/copy-paper-ream",
      },
    ],
    total: { amountCents: 1298 },
    purpose: "Restock printer paper for the office.",
  },
}).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type SpendRequest
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>idempotencyKey</code> | <code>string</code> | Unique per purchase. Reuse it only to retry the same request. A UUID works. |
| <code>body</code> | <code>[SpendRequestCreate](src/models/spend-request-create.ts)</code> | The store, the cart, its total and the agent's reason for buying. |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.spendRequests.createSpendRequest(request)`

- **OnSuccess**: <code>[SpendRequest](src/models/spend-request.ts)</code>
- **OnError**: throws <code>[SpendRequests.CreateSpendRequestError](src/resources/spend-requests.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.spendRequests.createSpendRequest(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;SpendRequest, SpendRequests.CreateSpendRequestError&gt;</code>, with `result.value` of type <code>[SpendRequest](src/models/spend-request.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[CosignAgentApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>getSpendRequest(request: SpendRequests.GetSpendRequestRequest, options?: RequestOptions): ApiPromise&lt;SpendRequest, SpendRequests.GetSpendRequestError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

One of this agent's requests. Poll it while it is `PENDING_APPROVAL` or `PROCESSING` (every few seconds is fine).

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.spendRequests.getSpendRequest({
    spendRequestId: "91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f",
  });
  // TODO: Handle 'response' of type SpendRequest
} catch (err) {
  // TODO: Handle 'err' of type SpendRequests.GetSpendRequestError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.spendRequests.getSpendRequest({
  spendRequestId: "91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f",
}).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type SpendRequest
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>spendRequestId</code> | <code>string</code> | The `id` of a spend request this agent created. |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.spendRequests.getSpendRequest(request)`

- **OnSuccess**: <code>[SpendRequest](src/models/spend-request.ts)</code>
- **OnError**: throws <code>[SpendRequests.GetSpendRequestError](src/resources/spend-requests.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.spendRequests.getSpendRequest(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;SpendRequest, SpendRequests.GetSpendRequestError&gt;</code>, with `result.value` of type <code>[SpendRequest](src/models/spend-request.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[CosignAgentApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>listSpendRequests(request: SpendRequests.ListSpendRequestsRequest, options?: RequestOptions): ApiPromise&lt;SpendRequestList, SpendRequests.ListSpendRequestsError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

This agent's own requests, newest first. Not paginated yet; `next_cursor` is always `null` in this version.

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.spendRequests.listSpendRequests({ limit: 25 });
  // TODO: Handle 'response' of type SpendRequestList
} catch (err) {
  // TODO: Handle 'err' of type SpendRequests.ListSpendRequestsError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.spendRequests.listSpendRequests({ limit: 25 }).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type SpendRequestList
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>limit?</code> | <code>number</code> | How many to return, newest first.<br>**Default**: 25 |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.spendRequests.listSpendRequests(request)`

- **OnSuccess**: <code>[SpendRequestList](src/models/spend-request-list.ts)</code>
- **OnError**: throws <code>[SpendRequests.ListSpendRequestsError](src/resources/spend-requests.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.spendRequests.listSpendRequests(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;SpendRequestList, SpendRequests.ListSpendRequestsError&gt;</code>, with `result.value` of type <code>[SpendRequestList](src/models/spend-request-list.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[CosignAgentApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

