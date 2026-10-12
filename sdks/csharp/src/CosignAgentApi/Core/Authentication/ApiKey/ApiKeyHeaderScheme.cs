using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.ApiKey;

internal sealed class ApiKeyHeaderScheme : IAuthScheme
{
    private readonly string _headerName;
    private readonly string _apiKey;

    public ApiKeyHeaderScheme(string headerName, string apiKey)
    {
        _headerName = headerName;
        _apiKey = apiKey;
    }

    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Add(_headerName, _apiKey);
        return default;
    }
}

internal static class ApiKeyHeaderSchemeExtensions
{
    extension(ApiKeyHeaderScheme)
    {
        public static IAuthScheme Create(string paramName, string? apiKey) =>
            apiKey is not null
                ? new ApiKeyHeaderScheme(paramName, apiKey)
                : NoneAuthScheme.Instance;
    }
}
