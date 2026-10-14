using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// How the best match's price compares with like-for-like listings, judged by AI.
/// </summary>
public record MarketComparison
{
    [JsonPropertyName("product")]
    public required string Product { get; init; }

    /// <summary>
    /// How a price compares with like-for-like listings; <c>none</c> when no listing was comparable.
    /// </summary>
    [JsonPropertyName("verdict")]
    public required MarketVerdict Verdict { get; init; }

    [JsonPropertyName("note")]
    public required string Note { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
