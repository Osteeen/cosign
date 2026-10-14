<!-- Generated file — do not edit; regenerated with the SDK. -->

# Agent — operations

Accessor: `client.agent` · Source: `src/resources/agent.ts` · 1 operation · Request and error types: namespace `Agent`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `cosign-agent-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### getAllowance

- **Signature**: `getAllowance(options?: RequestOptions): ApiPromise<Allowance, Agent.GetAllowanceError>`
- **Wire**: `GET /agent/me`
- **Auth**: `agentToken`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `Allowance`
- **Error**: `CosignAgentApiError` with `kind: "api"`, an instance of `Agent.GetAllowanceError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"problem"` [401] `Problem` · `"problem2"` [500] `Problem` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `Allowance` | `allowanceSchema` | `src/models/allowance.ts` |
| `Problem` | `problemSchema` | `src/models/problem.ts` |

