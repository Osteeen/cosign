<!-- Generated file — do not edit; regenerated with the SDK. -->

# Authentication — operations

Accessor: `client.authentication` · Source: `cosign_agent_api/apis/authentication.py` · 1 operation

Each `###` block is one operation and assumes `sdk-map.md` is loaded: blocks omit what its invariants table covers and are otherwise self-contained, so chunk at block level. Signatures are the sync parsed spelling; the async and raw spellings take the same parameters (see sdk-map.md). **Type sources** names the module declaring each type an operation mentions, so resolving a body, return or error payload is a lookup rather than a search; the runtime types `RawError` and `ApiResult` are excluded.

### client.authentication.create_token

- **Route**: `POST /agent/token`
- **Auth**: `agent_key`
- **Signature**: `def create_token(*, request_options: RequestOptionsOrDict | None = None)`
- **Returns (parsed)**: `AgentToken`
- **Returns (raw)**: `ApiResult[AgentToken, CreateTokenErrorBody]`
- **Error**: `CreateTokenErrorBody` — **Case A (typed)**
- **Error arms**: `RawError` [401, 429, 500, anything unmapped]

| Type | Source |
| --- | --- |
| `AgentToken` | `cosign_agent_api/models/agent_token.py` |
| `CreateTokenErrorBody` | `cosign_agent_api/errors/create_token_error.py` |

