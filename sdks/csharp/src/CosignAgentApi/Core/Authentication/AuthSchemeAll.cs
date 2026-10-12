using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication;

/// <summary>
/// Represents a set of schemes that must all apply (AND logic).
/// </summary>
internal sealed class AuthSchemeAll : IRevocableAuthScheme
{
    private readonly IReadOnlyList<IAuthScheme> _schemes;

    public AuthSchemeAll(params IReadOnlyList<IAuthScheme> schemes)
    {
        if (schemes is null or [])
            throw new ArgumentException("Must provide at least one scheme.", nameof(schemes));
        if (schemes.Any(s => s is null))
            throw new ArgumentException("All schemes must be non-null.", nameof(schemes));
        _schemes = schemes;
    }

    public async ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        foreach (var scheme in _schemes)
            await scheme.Apply(request, cancellationToken).ConfigureAwait(false);
    }

    public void Invalidate() => _schemes.InvalidateRevocable();
}
