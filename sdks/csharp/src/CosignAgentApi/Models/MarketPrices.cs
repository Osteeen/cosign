using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid through Cosign; titles are third-party text.
/// </summary>
public record MarketPrices
{
    [JsonPropertyName("source")]
    public string Source { get; } = "Channel3";

    [JsonPropertyName("query")]
    public required string Query { get; init; }

    /// <summary>
    /// False when Channel3 did not answer; then there is no comparison.
    /// </summary>
    [JsonPropertyName("checked")]
    public required bool Checked { get; init; }

    [JsonPropertyName("comparison")]
    public required MarketComparison? Comparison { get; init; }

    /// <summary>
    /// Like-for-like listings when a comparison was made, otherwise the raw listings.
    /// </summary>
    [JsonPropertyName("offers")]
    public required IReadOnlyList<MarketOffer> Offers { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
