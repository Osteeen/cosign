<!-- Generated file — do not edit; regenerated with the SDK. -->

# SpendRequests — operations

Accessor: `client.SpendRequests` · Source: `src/CosignAgentApi/Api/SpendRequests.cs` · 3 operations

**Type sources**: the file declaring each type an operation names (`RawError` excluded — see sdk-map.md).

### CreateSpendRequest

- **Auth**: `options.AgentToken`
- **Signature**: `CreateSpendRequest(CreateSpendRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
  - required: `IdempotencyKey`, `Body`
- **Returns**: `SpendRequest`
- **Error**: `ApiException<CreateSpendRequestError>` — **Case A (typed)**
- **Error accessors**: `TryGetNoContent(out RawError)` [400, 401, 409, 429, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `CreateSpendRequest` | `src/CosignAgentApi/Requests/SpendRequests/CreateSpendRequest.cs` |
| `SpendRequestCreate` | `src/CosignAgentApi/Models/SpendRequestCreate.cs` |
| `SpendRequest` | `src/CosignAgentApi/Models/SpendRequest.cs` |
| `CreateSpendRequestError` | `src/CosignAgentApi/Errors/CreateSpendRequestError.cs` |

### GetSpendRequest

- **Auth**: `options.AgentToken`
- **Signature**: `GetSpendRequest(GetSpendRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
  - required: `SpendRequestId`
- **Returns**: `SpendRequest`
- **Error**: `ApiException<GetSpendRequestError>` — **Case A (typed)**
- **Error accessors**: `TryGetNoContent(out RawError)` [401, 404, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `GetSpendRequest` | `src/CosignAgentApi/Requests/SpendRequests/GetSpendRequest.cs` |
| `SpendRequest` | `src/CosignAgentApi/Models/SpendRequest.cs` |
| `GetSpendRequestError` | `src/CosignAgentApi/Errors/GetSpendRequestError.cs` |

### ListSpendRequests

- **Auth**: `options.AgentToken`
- **Signature**: `ListSpendRequests(ListSpendRequestsRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
- **Query params (wire ← C#)**: `limit` ← `Limit`
- **Returns**: `SpendRequestList`
- **Error**: `ApiException<ListSpendRequestsError>` — **Case A (typed)**
- **Error accessors**: `TryGetNoContent(out RawError)` [401, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `ListSpendRequestsRequest` | `src/CosignAgentApi/Requests/SpendRequests/ListSpendRequestsRequest.cs` |
| `SpendRequestList` | `src/CosignAgentApi/Models/SpendRequestList.cs` |
| `ListSpendRequestsError` | `src/CosignAgentApi/Errors/ListSpendRequestsError.cs` |

