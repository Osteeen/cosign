<!-- Generated file — do not edit; regenerated with the SDK. -->

# Agent — operations

Accessor: `client.Agent` · Source: `src/CosignAgentApi/Api/Agent.cs` · 1 operation

**Type sources**: the file declaring each type an operation names (`RawError` excluded — see sdk-map.md).

### GetAllowance

- **Auth**: `options.AgentToken`
- **Signature**: `GetAllowance(RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
- **Returns**: `Allowance`
- **Error**: `ApiException<GetAllowanceError>` — **Case A (typed)**
- **Error accessors**: `TryGetProblem(out Problem)` [401, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `Allowance` | `src/CosignAgentApi/Models/Allowance.cs` |
| `GetAllowanceError` | `src/CosignAgentApi/Errors/GetAllowanceError.cs` |
| `Problem` | `src/CosignAgentApi/Models/Problem.cs` |

