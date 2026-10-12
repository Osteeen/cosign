# Reference

Every operation below is shown in its throwing form. On an error status it throws `ApiException<TError>` — the status code, headers, content type and the operation's error type, `RawError` (the raw body) when the spec declares none — and where an operation offers an `…AsResult` sibling, that sibling returns `ApiResult<TResponse, TError>` instead. A request that produces no usable response surfaces as `SdkConnectionException` or `SdkTimeoutException`, a body that does not match the documented response type as `ResponseDeserializationException`, and a credential that cannot be applied as `AuthSchemeException`; all of them derive from `SdkException` and name the failed call. See [README → Error Handling](README.md#error-handling).

> Source: [CosignAgentApiClient](src/CosignAgentApi/CosignAgentApiClient.cs)

## Agent

> Source: [Agent](src/CosignAgentApi/Api/Agent.cs)

<details>
<summary><code>Task&lt;Allowance&gt; GetAllowance(RequestOptions? requestOptions = null, CancellationToken cancellationToken = default);</code></summary>

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

```csharp
try
{
    var response = await client.Agent.GetAllowance();
    // TODO: Handle 'response' of type Allowance
}
catch (ApiException<GetAllowanceError> ex)
{
    if (ex.Error.TryGetNoContent(out var error))
    {
        // TODO: Handle 'error' of type RawError
    }
}
```

</dd>
</dl>

### Response

<dl>
<dd>

**OnSuccess**: <code>[Allowance](src/CosignAgentApi/Models/Allowance.cs)</code>

**OnError**: <code>[ApiException](src/CosignAgentApi/Core/Exceptions/ApiException.cs)&lt;[GetAllowanceError](src/CosignAgentApi/Errors/GetAllowanceError.cs)&gt;</code>

</dd>
</dl>

</dd>
</dl>

</details>

## AuthenticationApi

> Source: [AuthenticationApi](src/CosignAgentApi/Api/AuthenticationApi.cs)

<details>
<summary><code>Task&lt;AgentToken&gt; CreateToken(RequestOptions? requestOptions = null, CancellationToken cancellationToken = default);</code></summary>

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

```csharp
try
{
    var response = await client.AuthenticationApi.CreateToken();
    // TODO: Handle 'response' of type AgentToken
}
catch (ApiException<CreateTokenError> ex)
{
    if (ex.Error.TryGetNoContent(out var error))
    {
        // TODO: Handle 'error' of type RawError
    }
}
```

</dd>
</dl>

### Response

<dl>
<dd>

**OnSuccess**: <code>[AgentToken](src/CosignAgentApi/Models/AgentToken.cs)</code>

**OnError**: <code>[ApiException](src/CosignAgentApi/Core/Exceptions/ApiException.cs)&lt;[CreateTokenError](src/CosignAgentApi/Errors/CreateTokenError.cs)&gt;</code>

</dd>
</dl>

</dd>
</dl>

</details>

## SpendRequests

> Source: [SpendRequests](src/CosignAgentApi/Api/SpendRequests.cs)

<details>
<summary><code>Task&lt;SpendRequest&gt; CreateSpendRequest(CreateSpendRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default);</code></summary>

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

```csharp
try
{
    var response = await client.SpendRequests.CreateSpendRequest(new CreateSpendRequest
    {
        IdempotencyKey = "6f1d2c3b-4a5e-4f60-8172-9a0b1c2d3e4f",
        Body = new SpendRequestCreate
        {
            StoreId = Guid.Parse("7d1c2b3a-4e5f-4a6b-9c7d-8e9f0a1b2c3d"),
            Items = [
                new LineItem
                {
                    Name = "Copy paper, letter, 500 sheets",
                    Category = Category.OfficeSupplies,
                    Quantity = 2,
                    UnitAmountCents = 649L,
                    ProductUrl = "http://localhost:3001/shop/paper-co/copy-paper-ream",
                },
            ],
            Total = new Money { AmountCents = 1298L },
            Purpose = "Restock printer paper for the office.",
        },
    });
    // TODO: Handle 'response' of type SpendRequest
}
catch (ApiException<CreateSpendRequestError> ex)
{
    if (ex.Error.TryGetNoContent(out var error))
    {
        // TODO: Handle 'error' of type RawError
    }
}
```

</dd>
</dl>

### Request

<dl>
<dd>

<code>[CreateSpendRequest](src/CosignAgentApi/Requests/SpendRequests/CreateSpendRequest.cs)</code>

</dd>
</dl>

### Response

<dl>
<dd>

**OnSuccess**: <code>[SpendRequest](src/CosignAgentApi/Models/SpendRequest.cs)</code>

**OnError**: <code>[ApiException](src/CosignAgentApi/Core/Exceptions/ApiException.cs)&lt;[CreateSpendRequestError](src/CosignAgentApi/Errors/CreateSpendRequestError.cs)&gt;</code>

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>Task&lt;SpendRequest&gt; GetSpendRequest(GetSpendRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default);</code></summary>

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

```csharp
try
{
    var response = await client.SpendRequests.GetSpendRequest(new GetSpendRequest
    {
        SpendRequestId = Guid.Parse("91d68fb2-5c1a-4b7e-8f20-3a4b5c6d7e8f"),
    });
    // TODO: Handle 'response' of type SpendRequest
}
catch (ApiException<GetSpendRequestError> ex)
{
    if (ex.Error.TryGetNoContent(out var error))
    {
        // TODO: Handle 'error' of type RawError
    }
}
```

</dd>
</dl>

### Request

<dl>
<dd>

<code>[GetSpendRequest](src/CosignAgentApi/Requests/SpendRequests/GetSpendRequest.cs)</code>

</dd>
</dl>

### Response

<dl>
<dd>

**OnSuccess**: <code>[SpendRequest](src/CosignAgentApi/Models/SpendRequest.cs)</code>

**OnError**: <code>[ApiException](src/CosignAgentApi/Core/Exceptions/ApiException.cs)&lt;[GetSpendRequestError](src/CosignAgentApi/Errors/GetSpendRequestError.cs)&gt;</code>

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>Task&lt;SpendRequestList&gt; ListSpendRequests(ListSpendRequestsRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default);</code></summary>

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

```csharp
try
{
    var response = await client.SpendRequests.ListSpendRequests(new ListSpendRequestsRequest { Limit = 25 });
    // TODO: Handle 'response' of type SpendRequestList
}
catch (ApiException<ListSpendRequestsError> ex)
{
    if (ex.Error.TryGetNoContent(out var error))
    {
        // TODO: Handle 'error' of type RawError
    }
}
```

</dd>
</dl>

### Request

<dl>
<dd>

<code>[ListSpendRequestsRequest](src/CosignAgentApi/Requests/SpendRequests/ListSpendRequestsRequest.cs)</code>

</dd>
</dl>

### Response

<dl>
<dd>

**OnSuccess**: <code>[SpendRequestList](src/CosignAgentApi/Models/SpendRequestList.cs)</code>

**OnError**: <code>[ApiException](src/CosignAgentApi/Core/Exceptions/ApiException.cs)&lt;[ListSpendRequestsError](src/CosignAgentApi/Errors/ListSpendRequestsError.cs)&gt;</code>

</dd>
</dl>

</dd>
</dl>

</details>

