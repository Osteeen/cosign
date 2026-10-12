namespace CosignAgentApi.Core.Authentication.OAuth2.Password;

public sealed class OAuth2PasswordCredentials
{
    public required string ClientId { get; init; }
    public string? ClientSecret { get; init; }
    public required string Username { get; init; }
    public required string Password { get; init; }
    public string? Scope { get; init; }
}
