using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using CosignAgentApi.Core.Exceptions;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core.Authentication;

/// <summary>
/// Represents multiple alternative schemes (OR logic).
/// Schemes with no credentials configured are not candidates and are skipped; the first
/// configured scheme that succeeds wins. If every configured scheme fails, throws
/// <see cref="AuthSchemeException"/>. With nothing configured the request goes out
/// unauthenticated, so the server decides — the same as a single unconfigured scheme.
/// </summary>
internal sealed class AuthSchemeAny : IRevocableAuthScheme
{
    private readonly IReadOnlyList<IAuthScheme> _schemes;

    public AuthSchemeAny(params IReadOnlyList<IAuthScheme> schemes)
    {
        if (schemes is null or [])
            throw new ArgumentException("Must provide at least one scheme.", nameof(schemes));
        if (schemes.Any(s => s is null))
            throw new ArgumentException("All schemes must be non-null.", nameof(schemes));
        _schemes = schemes;
    }

    public async ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var failures = new List<Exception>(_schemes.Count);

        foreach (var scheme in _schemes)
        {
            if (!scheme.IsConfigured())
                continue;

            try
            {
                await scheme.Apply(request, cancellationToken).ConfigureAwait(false);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                failures.Add(ex);
            }
        }

        if (failures.Count > 0)
        {
            var callContext = CallContext.For(request);
            throw new AuthSchemeException($"{callContext} could not be authenticated: no configured scheme succeeded.", failures)
            {
                Method = callContext.Method,
                RequestUri = callContext.RequestUri,
            };
        }
    }

    // We don't track which inner scheme won the last Apply, so on a 401 we invalidate every
    // revocable inner scheme. Over-invalidation is safe — at worst the next request through an
    // unrelated scheme pays for one extra credential fetch.
    public void Invalidate() => _schemes.InvalidateRevocable();
}
