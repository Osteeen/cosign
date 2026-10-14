<!-- Generated file — do not edit; regenerated with the SDK. -->

# Products — operations

Accessor: `client.Products` · Source: `src/CosignAgentApi/Api/Products.cs` · 1 operation

**Type sources**: the file declaring each type an operation names (`RawError` excluded — see sdk-map.md).

### FindProducts

- **Auth**: `options.AgentToken`
- **Signature**: `FindProducts(FindProductsRequest request, RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
  - required: `Q`
- **Query params (wire ← C#)**: `q` ← `Q`, `limit` ← `Limit`
- **Returns**: `ProductSearch`
- **Error**: `ApiException<FindProductsError>` — **Case A (typed)**
- **Error accessors**: `TryGetProblem(out Problem)` [400, 401, 429, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `FindProductsRequest` | `src/CosignAgentApi/Requests/Products/FindProductsRequest.cs` |
| `ProductSearch` | `src/CosignAgentApi/Models/ProductSearch.cs` |
| `FindProductsError` | `src/CosignAgentApi/Errors/FindProductsError.cs` |
| `Problem` | `src/CosignAgentApi/Models/Problem.cs` |

