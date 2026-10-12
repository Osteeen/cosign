# Raw Reference

**Raw** endpoints, reached through `with_raw_response`, return `ApiResult[T, E]` and never raise for an API error. For the parsed endpoints, see [API Reference](api-reference.md).

> Source: [CosignAgentApiClient](cosign_agent_api/client.py)

## Agent

> Source: [Agent](cosign_agent_api/apis/agent.py)

<details>
<summary><code>def get_allowance(*, request_options: RequestOptionsOrDict | None = None) -> ApiResult[Allowance, GetAllowanceErrorBody]</code></summary>

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

### Usage

<dl>
<dd>

**Sync**

```python
result = client.agent.with_raw_response.get_allowance()
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type Allowance
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type GetAllowanceErrorBody
```

**Async**

```python
result = await async_client.agent.with_raw_response.get_allowance()
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type Allowance
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type GetAllowanceErrorBody
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>request_options</code> | <code>[RequestOptionsOrDict](cosign_agent_api/core/request_options.py) \| None</code> | Per-call overrides for this one request, such as a timeout, extra headers, or its retry count and statuses. |

</dd>
</dl>

### Response

<dl>
<dd>

**Returns**: <code>[ApiResult](cosign_agent_api/core/results.py)&#91;[Allowance](cosign_agent_api/models/allowance.py), [GetAllowanceErrorBody](cosign_agent_api/errors/get_allowance_error.py)&#93;</code>

**On `Success`**: `payload` is <code>[Allowance](cosign_agent_api/models/allowance.py)</code> -- The current allowance

**On `Failure`**: `error` is <code>[GetAllowanceErrorBody](cosign_agent_api/errors/get_allowance_error.py)</code>

Mapped in first-match order -- an earlier row wins over a later range that also covers the status:

| Status | `error` is |
| --- | --- |
| 401, 500 | <code>[RawError](cosign_agent_api/core/results.py)</code> |
| anything unmapped | <code>[RawError](cosign_agent_api/core/results.py)</code> |

</dd>
</dl>

</dd>
</dl>

</details>

## Authentication

> Source: [Authentication](cosign_agent_api/apis/authentication.py)

<details>
<summary><code>def create_token(*, request_options: RequestOptionsOrDict | None = None) -> ApiResult[AgentToken, CreateTokenErrorBody]</code></summary>

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

### Usage

<dl>
<dd>

**Sync**

```python
result = client.authentication.with_raw_response.create_token()
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type AgentToken
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type CreateTokenErrorBody
```

**Async**

```python
result = await async_client.authentication.with_raw_response.create_token()
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type AgentToken
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type CreateTokenErrorBody
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>request_options</code> | <code>[RequestOptionsOrDict](cosign_agent_api/core/request_options.py) \| None</code> | Per-call overrides for this one request, such as a timeout, extra headers, or its retry count and statuses. |

</dd>
</dl>

### Response

<dl>
<dd>

**Returns**: <code>[ApiResult](cosign_agent_api/core/results.py)&#91;[AgentToken](cosign_agent_api/models/agent_token.py), [CreateTokenErrorBody](cosign_agent_api/errors/create_token_error.py)&#93;</code>

**On `Success`**: `payload` is <code>[AgentToken](cosign_agent_api/models/agent_token.py)</code> -- Token issued

**On `Failure`**: `error` is <code>[CreateTokenErrorBody](cosign_agent_api/errors/create_token_error.py)</code>

Mapped in first-match order -- an earlier row wins over a later range that also covers the status:

| Status | `error` is |
| --- | --- |
| 401, 429, 500 | <code>[RawError](cosign_agent_api/core/results.py)</code> |
| anything unmapped | <code>[RawError](cosign_agent_api/core/results.py)</code> |

</dd>
</dl>

</dd>
</dl>

</details>

## SpendRequests

> Source: [SpendRequests](cosign_agent_api/apis/spend_requests.py)

<details>
<summary><code>def create_spend_request(idempotency_key: str, body: SpendRequestCreate | SpendRequestCreateDict, *, request_options: RequestOptionsOrDict | None = None) -> ApiResult[SpendRequest, CreateSpendRequestErrorBody]</code></summary>

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

### Usage

<dl>
<dd>

**Sync**

```python
result = client.spend_requests.with_raw_response.create_spend_request(
    "6f1d2c3b-4a5e-4f60-8172-9a0b1c2d3e4f",
    SpendRequestCreate(
        store_id=UUID("7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d"),
        items=[
            LineItem(
                name="Copy paper, letter, 500 sheets",
                category=Category.OFFICE_SUPPLIES,
                quantity=2,
                unit_amount_cents=649,
                product_url="http://localhost:3001/shop/paper-co/copy-paper-ream",
            ),
        ],
        total=Money(amount_cents=1298),
        purpose="Restock printer paper for the office.",
    ),
)
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequest
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type CreateSpendRequestErrorBody
```

**Async**

```python
result = await async_client.spend_requests.with_raw_response.create_spend_request(
    "6f1d2c3b-4a5e-4f60-8172-9a0b1c2d3e4f",
    SpendRequestCreate(
        store_id=UUID("7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d"),
        items=[
            LineItem(
                name="Copy paper, letter, 500 sheets",
                category=Category.OFFICE_SUPPLIES,
                quantity=2,
                unit_amount_cents=649,
                product_url="http://localhost:3001/shop/paper-co/copy-paper-ream",
            ),
        ],
        total=Money(amount_cents=1298),
        purpose="Restock printer paper for the office.",
    ),
)
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequest
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type CreateSpendRequestErrorBody
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>idempotency_key</code> | <code>str</code> | Unique per purchase. Reuse it only to retry the same request. A UUID works. |
| <code>body</code> | <code>[SpendRequestCreate](cosign_agent_api/models/spend_request_create.py) \| [SpendRequestCreateDict](cosign_agent_api/models/spend_request_create.py)</code> | The store, the cart, its total and the agent's reason for buying. |
| <code>request_options</code> | <code>[RequestOptionsOrDict](cosign_agent_api/core/request_options.py) \| None</code> | Per-call overrides for this one request, such as a timeout, extra headers, or its retry count and statuses. |

</dd>
</dl>

### Response

<dl>
<dd>

**Returns**: <code>[ApiResult](cosign_agent_api/core/results.py)&#91;[SpendRequest](cosign_agent_api/models/spend_request.py), [CreateSpendRequestErrorBody](cosign_agent_api/errors/create_spend_request_error.py)&#93;</code>

**On `Success`**: `payload` is <code>[SpendRequest](cosign_agent_api/models/spend_request.py)</code> -- A retry with an Idempotency-Key already used for this exact request. Returns the original result unchanged.

**On `Failure`**: `error` is <code>[CreateSpendRequestErrorBody](cosign_agent_api/errors/create_spend_request_error.py)</code>

Mapped in first-match order -- an earlier row wins over a later range that also covers the status:

| Status | `error` is |
| --- | --- |
| 400, 401, 409, 429, 500 | <code>[RawError](cosign_agent_api/core/results.py)</code> |
| anything unmapped | <code>[RawError](cosign_agent_api/core/results.py)</code> |

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>def get_spend_request(spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None) -> ApiResult[SpendRequest, GetSpendRequestErrorBody]</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

One of this agent's requests. Poll it while it is `PENDING_APPROVAL` or `PROCESSING` (every few seconds is fine).

</dd>
</dl>

### Usage

<dl>
<dd>

**Sync**

```python
result = client.spend_requests.with_raw_response.get_spend_request(UUID("91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f"))
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequest
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type GetSpendRequestErrorBody
```

**Async**

```python
result = await async_client.spend_requests.with_raw_response.get_spend_request(
    UUID("91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f")
)
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequest
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type GetSpendRequestErrorBody
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>spend_request_id</code> | <code>UUID</code> | The `id` of a spend request this agent created. |
| <code>request_options</code> | <code>[RequestOptionsOrDict](cosign_agent_api/core/request_options.py) \| None</code> | Per-call overrides for this one request, such as a timeout, extra headers, or its retry count and statuses. |

</dd>
</dl>

### Response

<dl>
<dd>

**Returns**: <code>[ApiResult](cosign_agent_api/core/results.py)&#91;[SpendRequest](cosign_agent_api/models/spend_request.py), [GetSpendRequestErrorBody](cosign_agent_api/errors/get_spend_request_error.py)&#93;</code>

**On `Success`**: `payload` is <code>[SpendRequest](cosign_agent_api/models/spend_request.py)</code> -- The spend request

**On `Failure`**: `error` is <code>[GetSpendRequestErrorBody](cosign_agent_api/errors/get_spend_request_error.py)</code>

Mapped in first-match order -- an earlier row wins over a later range that also covers the status:

| Status | `error` is |
| --- | --- |
| 401, 404, 500 | <code>[RawError](cosign_agent_api/core/results.py)</code> |
| anything unmapped | <code>[RawError](cosign_agent_api/core/results.py)</code> |

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>def list_spend_requests(*, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None) -> ApiResult[SpendRequestList, ListSpendRequestsErrorBody]</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

This agent's own requests, newest first. Not paginated yet; `next_cursor` is always `null` in this version.

</dd>
</dl>

### Usage

<dl>
<dd>

**Sync**

```python
result = client.spend_requests.with_raw_response.list_spend_requests(limit=25)
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequestList
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type ListSpendRequestsErrorBody
```

**Async**

```python
result = await async_client.spend_requests.with_raw_response.list_spend_requests(limit=25)
match result:
    case Success(payload=payload):
        ...  # TODO: Handle 'payload' of type SpendRequestList
    case Failure(error=error):
        ...  # TODO: Handle 'error' of type ListSpendRequestsErrorBody
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>limit</code> | <code>int \| None</code> | How many to return, newest first.<br>**Default**: <code>25</code> |
| <code>request_options</code> | <code>[RequestOptionsOrDict](cosign_agent_api/core/request_options.py) \| None</code> | Per-call overrides for this one request, such as a timeout, extra headers, or its retry count and statuses. |

</dd>
</dl>

### Response

<dl>
<dd>

**Returns**: <code>[ApiResult](cosign_agent_api/core/results.py)&#91;[SpendRequestList](cosign_agent_api/models/spend_request_list.py), [ListSpendRequestsErrorBody](cosign_agent_api/errors/list_spend_requests_error.py)&#93;</code>

**On `Success`**: `payload` is <code>[SpendRequestList](cosign_agent_api/models/spend_request_list.py)</code> -- The most recent spend requests

**On `Failure`**: `error` is <code>[ListSpendRequestsErrorBody](cosign_agent_api/errors/list_spend_requests_error.py)</code>

Mapped in first-match order -- an earlier row wins over a later range that also covers the status:

| Status | `error` is |
| --- | --- |
| 401, 500 | <code>[RawError](cosign_agent_api/core/results.py)</code> |
| anything unmapped | <code>[RawError](cosign_agent_api/core/results.py)</code> |

</dd>
</dl>

</dd>
</dl>

</details>

