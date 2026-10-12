using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.Bearer;

internal sealed class BearerAuthScheme : IAuthScheme
{
    private readonly string _token;

    public BearerAuthScheme(string token) => _token = token;

    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return default;
    }
}

internal static class BearerAuthSchemeExtensions
{
    extension(BearerAuthScheme)
    {
        public static IAuthScheme Create(string? token) =>
            token is not null
                ? new BearerAuthScheme(token)
                : NoneAuthScheme.Instance;
    }
}
    