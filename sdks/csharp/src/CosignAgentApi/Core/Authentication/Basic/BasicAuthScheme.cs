using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.Basic;

internal sealed class BasicAuthScheme : IAuthScheme
{
    private readonly BasicAuthCredentials _credentials;

    public BasicAuthScheme(BasicAuthCredentials credentials) => _credentials = credentials;

    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var encoded = _credentials.Encode();
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", encoded);
        return default;
    }
}

internal static class BasicAuthSchemeExtensions
{
    extension(BasicAuthScheme)
    {
        public static IAuthScheme Create(BasicAuthCredentials? credentials) =>
            credentials is not null
                ? new BasicAuthScheme(credentials)
                : NoneAuthScheme.Instance;
    }
}
