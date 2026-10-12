using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using CosignAgentApi.Core.Exceptions;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core.Authentication;

public interface IAuthScheme
{
    ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken);
}

internal static class AuthSchemeExtensions
{
    extension(IAuthScheme scheme)
    {
        public bool IsConfigured() => scheme is not NoneAuthScheme;
    }

    extension(IEnumerable<IAuthScheme> authSchemes)
    {
        public async ValueTask Apply(HttpRequestMessage httpRequest, CancellationToken cancellationToken)
        {
            foreach (var authScheme in authSchemes)
            {
                try
                {
                    await authScheme.Apply(httpRequest, cancellationToken).ConfigureAwait(false);
                }
                catch (Exception ex) when (ex is not (OperationCanceledException or AuthSchemeException))
                {
                    var callContext = CallContext.For(httpRequest);
                    throw new AuthSchemeException($"{callContext} could not be authenticated: {ex.Message}", [ex])
                    {
                        Method = callContext.Method,
                        RequestUri = callContext.RequestUri,
                    };
                }
            }
        }

        public void InvalidateRevocable()
        {
            foreach (var scheme in authSchemes.OfType<IRevocableAuthScheme>())
                scheme.Invalidate();
        }
    }
}
