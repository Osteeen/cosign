using System;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication.ApiKey;

internal sealed class ApiKeyCookieScheme : IAuthScheme
{
    private readonly string _cookieName;
    private readonly string _apiKey;

    public ApiKeyCookieScheme(string cookieName, string apiKey)
    {
        _cookieName = cookieName;
        _apiKey = apiKey;
    }

    // RFC 6265: merge into a single Cookie header, replacing any existing value for this name
    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var newCookie = $"{_cookieName}={Uri.EscapeDataString(_apiKey)}";

        request.Headers.TryGetValues("Cookie", out var existing);
        request.Headers.Remove("Cookie");

        if (existing is null)
        {
            request.Headers.Add("Cookie", newCookie);
            return default;
        }

        var replacePrefix = _cookieName + "=";
        var otherCookies = existing
            .SelectMany(h => h.Split([';'], StringSplitOptions.RemoveEmptyEntries))
            .Select(c => c.Trim())
            .Where(c => !c.StartsWith(replacePrefix, StringComparison.OrdinalIgnoreCase));

        request.Headers.Add("Cookie", string.Join("; ", otherCookies.Append(newCookie)));
        return default;
    }
}

internal static class ApiKeyCookieSchemeExtensions
{
    extension(ApiKeyCookieScheme)
    {
        public static IAuthScheme Create(string paramName, string? apiKey) =>
            apiKey is not null
                ? new ApiKeyCookieScheme(paramName, apiKey)
                : NoneAuthScheme.Instance;
    }
}
