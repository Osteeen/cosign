using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// A short-lived token for the agent API.
/// </summary>
public record AgentToken
{
    /// <summary>
    /// Send it as <c>Authorization: Bearer &lt;access_token&gt;</c>.
    /// </summary>
    [JsonPropertyName("access_token")]
    public required string AccessToken { get; init; }

    /// <summary>
    /// How to send the token.
    /// </summary>
    [JsonPropertyName("token_type")]
    public string TokenType { get; } = "Bearer";

    /// <summary>
    /// Seconds until it expires. 900 in this version.
    /// </summary>
    [JsonPropertyName("expires_in")]
    public required int ExpiresIn { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
