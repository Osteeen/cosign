using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// A store the agent can pay right now, and what is left in its budget hold.
/// </summary>
public record StoreAllowance
{
    /// <summary>
    /// A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed.
    /// </summary>
    [JsonPropertyName("store")]
    public required Store Store { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("remaining_in_hold")]
    public required Money RemainingInHold { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
