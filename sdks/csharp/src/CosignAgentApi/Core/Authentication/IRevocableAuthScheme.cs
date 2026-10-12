namespace CosignAgentApi.Core.Authentication;

/// <summary>
/// Implemented by auth schemes that maintain cached credential state (e.g., an OAuth2 access token)
/// which can become invalid before its natural expiry — for example, server-side revocation,
/// suspicious-activity termination, or a scope policy change.
/// </summary>
/// <remarks>
/// When <see cref="RawClient"/> observes a <c>401 Unauthorized</c> response on a request that used
/// a revocable scheme, it calls <see cref="Invalidate"/> so the next request re-acquires a fresh
/// credential rather than continuing to send the rejected one until the cache entry expires
/// naturally. The current request is not retried automatically.
/// <para>
/// Composite schemes (e.g. <c>AuthSchemeAll</c>, <c>AuthSchemeAny</c>) implement this interface
/// and propagate <see cref="Invalidate"/> to every revocable inner scheme.
/// </para>
/// <para>
/// <b>Concurrency contract.</b> <see cref="Invalidate"/> is non-blocking and does not synchronize
/// with an in-flight credential fetch in another thread. If a fetch is mid-flight, it may complete
/// and cache its result after <see cref="Invalidate"/> returns — the freshly fetched credential
/// was issued by the authorization server <i>after</i> the moment of invalidation, so caching it
/// is correct. The only consequence is that a subsequent invalidation-driven refetch may be
/// skipped. This is intentional: <see cref="Invalidate"/> is a hint, not a barrier.
/// </para>
/// </remarks>
public interface IRevocableAuthScheme : IAuthScheme
{
    /// <summary>
    /// Drops any cached credential state. Safe to call concurrently and idempotently.
    /// </summary>
    void Invalidate();
}
