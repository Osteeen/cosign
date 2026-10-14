<!-- Generated file — do not edit; regenerated with the SDK. -->

# Products — operations

Accessor: `client.products` · Source: `cosign_agent_api/apis/products.py` · 1 operation

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.products.find_products

- **Route**: `GET /agent/products`
- **Auth**: `agent_token`
- **Signature**: `def find_products(q: str, *, limit: int | None = 8, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `q`
- **Params**: `q` — query · `limit` — query
- **Returns (parsed)**: `ProductSearch`
- **Returns (raw)**: `ApiResult[ProductSearch, FindProductsErrorBody]`
- **Error**: `FindProductsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 403, 429, 500] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `ProductSearch` | `cosign_agent_api/models/product_search.py` |
| `FindProductsErrorBody` | `cosign_agent_api/errors/find_products_error.py` |
| `Problem` | `cosign_agent_api/models/problem.py` |

