<!-- Generated file — do not edit; regenerated with the SDK. -->

# SpendRequests — operations

Accessor: `client.spendRequests` · Source: `src/resources/spend-requests.ts` · 3 operations · Request and error types: namespace `SpendRequests`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `cosign-agent-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### createSpendRequest

- **Signature**: `createSpendRequest(request: SpendRequests.CreateSpendRequestRequest, options?: RequestOptions): ApiPromise<SpendRequest, SpendRequests.CreateSpendRequestError>`
- **Wire**: `POST /agent/spend-requests`
- **Auth**: `agentToken`
- **Request body**: `application/json` — the `body` field
- **Returns**: `SpendRequest`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `SpendRequests.CreateSpendRequestError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [400] `Problem` · `"problem2"` [401] `Problem` · `"problem3"` [409] `Problem` · `"problem4"` [429] `Problem` · `"problem5"` [500] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SpendRequests.CreateSpendRequestRequest` (2):

| Field | Channel | Wire | Type | Req |
| --- | --- | --- | --- | --- |
| `idempotencyKey` | `header` | `Idempotency-Key` | `string` | yes |
| `body` | `body` | — | `SpendRequestCreate` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `SpendRequestCreate` | `spendRequestCreateSchema` | `src/models/spend-request-create.ts` |
| `SpendRequest` | `spendRequestSchema` | `src/models/spend-request.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### getSpendRequest

- **Signature**: `getSpendRequest(request: SpendRequests.GetSpendRequestRequest, options?: RequestOptions): ApiPromise<SpendRequest, SpendRequests.GetSpendRequestError>`
- **Wire**: `GET /agent/spend-requests/{spendRequestId}`
- **Auth**: `agentToken`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `SpendRequest`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `SpendRequests.GetSpendRequestError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [401] `Problem` · `"problem2"` [404] `Problem` · `"problem3"` [500] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SpendRequests.GetSpendRequestRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `spendRequestId` | `path` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `SpendRequest` | `spendRequestSchema` | `src/models/spend-request.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

### listSpendRequests

- **Signature**: `listSpendRequests(request: SpendRequests.ListSpendRequestsRequest, options?: RequestOptions): ApiPromise<SpendRequestList, SpendRequests.ListSpendRequestsError>`
- **Wire**: `GET /agent/spend-requests`
- **Auth**: `agentToken`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `SpendRequestList`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `SpendRequests.ListSpendRequestsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [401] `Problem` · `"problem2"` [500] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `SpendRequests.ListSpendRequestsRequest` (1):

| Field | Channel | Type | Req | Default |
| --- | --- | --- | --- | --- |
| `limit` | `query` | `number` | no | `25` |

| Type | Schema value | Source |
| --- | --- | --- |
| `SpendRequestList` | `spendRequestListSchema` | `src/models/spend-request-list.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

