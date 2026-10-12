using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.OAuth2;

/// <summary>
/// Token acquisition strategy for OAuth2 grant types where the scheme does not manage refresh
/// tokens (e.g., Client Credentials). For grant types that may issue refresh tokens, see
/// <see cref="IOAuth2RefreshableTokenStrategy{TCredentials}"/>.
/// Caching is handled by <see cref="OAuth2Scheme{TCredentials}"/>.
/// </summary>
public interface IOAuth2TokenStrategy<in TCredentials>
{
    Task<OAuthToken> GetToken(TCredentials credentials, CancellationToken cancellationToken);
}
