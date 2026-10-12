using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation.Attributes;

namespace CosignAgentApi.Models;

/// <summary>
/// An amount of money in integer cents.
/// </summary>
public record Money
{
    /// <summary>
    /// Integer cents. 1234 = $12.34.
    /// </summary>
    [JsonPropertyName("amount_cents")]
    [Minimum(0)]
    [Maximum(10000000)]
    public required long AmountCents { get; init; }

    /// <summary>
    /// ISO 4217 currency code. Only US dollars in this version.
    /// </summary>
    [JsonPropertyName("currency")]
    public string Currency { get; } = "USD";

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
