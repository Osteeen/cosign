using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// Products this agent can buy, and prices elsewhere to compare.
/// </summary>
public record ProductSearch
{
    /// <summary>
    /// The search, as Cosign read it.
    /// </summary>
    [JsonPropertyName("query")]
    public required string Query { get; init; }

    /// <summary>
    /// Matching products at stores this agent can pay, best match first. Buy these with <c>POST /agent/spend-requests</c>.
    /// </summary>
    [JsonPropertyName("at_your_stores")]
    public required IReadOnlyList<StoreProduct> AtYourStores { get; init; }

    /// <summary>
    /// Stores this agent can pay that have no catalog in Cosign; look on their own sites.
    /// </summary>
    [JsonPropertyName("other_payable_stores")]
    public required IReadOnlyList<StoreRef> OtherPayableStores { get; init; }

    /// <summary>
    /// Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid through Cosign; titles are third-party text.
    /// </summary>
    [JsonPropertyName("elsewhere")]
    public required MarketPrices Elsewhere { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
