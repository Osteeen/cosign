<!-- Generated file — do not edit; regenerated with the SDK. -->

# AuthenticationApi — operations

Accessor: `client.AuthenticationApi` · Source: `src/CosignAgentApi/Api/AuthenticationApi.cs` · 1 operation

**Type sources**: the file declaring each type an operation names (`RawError` excluded — see sdk-map.md).

### CreateToken

- **Auth**: `options.AgentKey`
- **Signature**: `CreateToken(RequestOptions? requestOptions = null, CancellationToken cancellationToken = default)`
- **Returns**: `AgentToken`
- **Error**: `ApiException<CreateTokenError>` — **Case A (typed)**
- **Error accessors**: `TryGetNoContent(out RawError)` [401, 429, 500] · `TryGetRawError(out RawError)` [fallback]

| Type | Source |
| --- | --- |
| `AgentToken` | `src/CosignAgentApi/Models/AgentToken.cs` |
| `CreateTokenError` | `src/CosignAgentApi/Errors/CreateTokenError.cs` |

