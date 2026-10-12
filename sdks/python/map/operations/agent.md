<!-- Generated file — do not edit; regenerated with the SDK. -->

# Agent — operations

Accessor: `client.agent` · Source: `cosign_agent_api/apis/agent.py` · 1 operation

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.agent.get_allowance

- **Route**: `GET /agent/me`
- **Auth**: `agent_token`
- **Signature**: `def get_allowance(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `Allowance`
- **Returns (raw)**: `ApiResult[Allowance, GetAllowanceErrorBody]`
- **Error**: `GetAllowanceErrorBody` — **Case A (typed)**
- **Error arms**: `RawError` [401, 500, anything unmapped]

| Type | Source |
| --- | --- |
| `Allowance` | `cosign_agent_api/models/allowance.py` |
| `GetAllowanceErrorBody` | `cosign_agent_api/errors/get_allowance_error.py` |

