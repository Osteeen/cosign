<!-- Generated file — do not edit; regenerated with the SDK. -->

# Authentication — operations

Accessor: `client.authentication` · Source: `src/resources/authentication.ts` · 1 operation · Request and error types: namespace `Authentication`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `cosign-agent-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### createToken

- **Signature**: `createToken(options?: RequestOptions): ApiPromise<AgentToken, Authentication.CreateTokenError>`
- **Wire**: `POST /agent/token`
- **Auth**: `agentKey`
- **Request body**: none — no `Content-Type` header is sent
- **SDK-sent**: `header Idempotency-Key` (minted per call)
- **Returns**: `AgentToken`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `Authentication.CreateTokenError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"error401"` [401] no body · `"error429"` [429] no body · `"error500"` [500] no body · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `AgentToken` | `agentTokenSchema` | `src/models/agent-token.ts` |

