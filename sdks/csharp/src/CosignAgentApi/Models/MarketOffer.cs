using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

public record MarketOffer
{
    /// <summary>
    /// The retailer's own product title (third-party text).
    /// </summary>
    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("merchant_domain")]
    public required string MerchantDomain { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("price")]
    public required Money Price { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
