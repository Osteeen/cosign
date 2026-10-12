using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.OAuth2;

/// <summary>
/// Token acquisition strategy for OAuth2 grant types that can issue refresh tokens
/// (Authorization Code Grant).
/// Caching and refresh-then-fallthrough logic are handled by
/// <see cref="OAuth2RefreshableScheme{TCredentials}"/>.
/// </summary>
public interface IOAuth2RefreshableTokenStrategy<in TCredentials>
{
    Task<OAuthTokenRefreshable> GetToken(TCredentials credentials, CancellationToken cancellationToken);

    /// <summary>
    /// Attempts to refresh an expired token. Returns <c>null</c> to signal that
    /// the refresh failed — the caller will then invoke <see cref="GetToken"/> to
    /// perform a fresh authentication.
    /// </summary>
    Task<OAuthTokenRefreshable?> TryRefreshToken(
        TCredentials credentials,
        string refreshToken,
        CancellationToken cancellationToken);
}
