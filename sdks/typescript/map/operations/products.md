<!-- Generated file — do not edit; regenerated with the SDK. -->

# Products — operations

Accessor: `client.products` · Source: `src/resources/products.ts` · 1 operation · Request and error types: namespace `Products`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `cosign-agent-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### findProducts

- **Signature**: `findProducts(request: Products.FindProductsRequest, options?: RequestOptions): ApiPromise<ProductSearch, Products.FindProductsError>`
- **Wire**: `GET /agent/products`
- **Auth**: `agentToken`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `ProductSearch`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `Products.FindProductsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [429] `Problem` · `"problem4"` [500] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Products.FindProductsRequest` (2):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `q` | `query` | `string` | yes | — |
| `limit` | `query` | `number` | no | `8` |

| Type | Schema value | Source |
| --- | --- | --- |
| `ProductSearch` | `productSearchSchema` | `src/models/product-search.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

