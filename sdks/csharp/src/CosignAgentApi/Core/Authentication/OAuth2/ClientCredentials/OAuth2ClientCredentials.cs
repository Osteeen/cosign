namespace CosignAgentApi.Core.Authentication.OAuth2.ClientCredentials;

public sealed class OAuth2ClientCredentials
{
    public required string ClientId { get; init; }
    public required string ClientSecret { get; init; }
    public string? Scope { get; init; }
}
