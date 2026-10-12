using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.ApiKey;

internal sealed class ApiKeyQueryScheme : IAuthScheme
{
    private readonly string _paramName;
    private readonly string _apiKey;

    public ApiKeyQueryScheme(string paramName, string apiKey)
    {
        _paramName = paramName;
        _apiKey = apiKey;
    }

    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.RequestUri = AppendQueryParam(request.RequestUri, _paramName, _apiKey);
        return default;
    }

    private static Uri AppendQueryParam(Uri? uri, string name, string value)
    {
        if (uri is null) throw new InvalidOperationException("RequestUri is null.");
        var builder = new UriBuilder(uri);
        var encodedParam = $"{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}";
        var existing = builder.Query.TrimStart('?');
        builder.Query = existing is null or "" ? encodedParam : $"{existing}&{encodedParam}";
        return builder.Uri;
    }
}

internal static class ApiKeyQuerySchemeExtensions
{
    extension(ApiKeyQueryScheme)
    {
        public static IAuthScheme Create(string paramName, string? apiKey) =>
            apiKey is not null
                ? new ApiKeyQueryScheme(paramName, apiKey)
                : NoneAuthScheme.Instance;
    }
}
