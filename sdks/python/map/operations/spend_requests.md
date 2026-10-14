<!-- Generated file — do not edit; regenerated with the SDK. -->

# SpendRequests — operations

Accessor: `client.spend_requests` · Source: `cosign_agent_api/apis/spend_requests.py` · 3 operations

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.spend_requests.create_spend_request

- **Route**: `POST /agent/spend-requests`
- **Auth**: `agent_token`
- **Signature**: `def create_spend_request(idempotency_key: str, body: SpendRequestCreate | SpendRequestCreateDict, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `idempotency_key`, `body`
- **Params**: `idempotency_key` — header `Idempotency-Key` · `body` — JSON body
- **Returns (parsed)**: `SpendRequest`
- **Returns (raw)**: `ApiResult[SpendRequest, CreateSpendRequestErrorBody]`
- **Error**: `CreateSpendRequestErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [400, 401, 409, 429, 500] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SpendRequestCreate` | `cosign_agent_api/models/spend_request_create.py` |
| `SpendRequestCreateDict` | `cosign_agent_api/models/spend_request_create.py` |
| `SpendRequest` | `cosign_agent_api/models/spend_request.py` |
| `CreateSpendRequestErrorBody` | `cosign_agent_api/errors/create_spend_request_error.py` |
| `Problem` | `cosign_agent_api/models/problem.py` |

### client.spend_requests.get_spend_request

- **Route**: `GET /agent/spend-requests/{spendRequestId}`
- **Auth**: `agent_token`
- **Signature**: `def get_spend_request(spend_request_id: UUID, *, request_options: RequestOptionsOrDict | None = None)`
  - required, positional: `spend_request_id`
- **Params**: `spend_request_id` — path `spendRequestId`
- **Returns (parsed)**: `SpendRequest`
- **Returns (raw)**: `ApiResult[SpendRequest, GetSpendRequestErrorBody]`
- **Error**: `GetSpendRequestErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [401, 404, 500] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SpendRequest` | `cosign_agent_api/models/spend_request.py` |
| `GetSpendRequestErrorBody` | `cosign_agent_api/errors/get_spend_request_error.py` |
| `Problem` | `cosign_agent_api/models/problem.py` |

### client.spend_requests.list_spend_requests

- **Route**: `GET /agent/spend-requests`
- **Auth**: `agent_token`
- **Signature**: `def list_spend_requests(*, limit: int | None = 25, request_options: RequestOptionsOrDict | None = None)`
- **Params**: `limit` — query
- **Returns (parsed)**: `SpendRequestList`
- **Returns (raw)**: `ApiResult[SpendRequestList, ListSpendRequestsErrorBody]`
- **Error**: `ListSpendRequestsErrorBody` — **Case A (typed)**
- **Error arms**: `Problem` [401, 500] · `RawError` [anything unmapped]

| Type | Source |
| --- | --- |
| `SpendRequestList` | `cosign_agent_api/models/spend_request_list.py` |
| `ListSpendRequestsErrorBody` | `cosign_agent_api/errors/list_spend_requests_error.py` |
| `Problem` | `cosign_agent_api/models/problem.py` |

