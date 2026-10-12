using CosignAgentApi.Core.Authentication;
using CosignAgentApi.Core.Authentication.Basic;
using CosignAgentApi.Core.Authentication.Bearer;

namespace CosignAgentApi;

internal sealed class AuthSchemes
{
    public IAuthScheme AgentKey { get; }
    public IAuthScheme AgentToken { get; }

    public AuthSchemes(CosignAgentApiClientOptions options)
    {
        AgentKey = BasicAuthScheme.Create(options.AgentKey);
        AgentToken = BearerAuthScheme.Create(options.AgentToken);
    }
}
