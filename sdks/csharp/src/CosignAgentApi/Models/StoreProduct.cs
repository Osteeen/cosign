using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation;
using CosignAgentApi.Core.Validation.Attributes;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// One product at a store this agent can pay.
/// </summary>
public record StoreProduct
{
    /// <summary>
    /// A store this agent can pay.
    /// </summary>
    [JsonPropertyName("store")]
    public required StoreSummary Store { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>
    /// Purchase categories a slip can allow.
    /// </summary>
    [JsonPropertyName("category")]
    public required Category Category { get; init; }

    /// <summary>
    /// What one unit is.
    /// </summary>
    [JsonPropertyName("unit")]
    public required string Unit { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("unit_price")]
    public required Money UnitPrice { get; init; }

    [JsonPropertyName("product_url")]
    [Format(FormatKind.Uri)]
    public required string ProductUrl { get; init; }

    /// <summary>
    /// What the rules alone would decide for buying one of this product now. The AI purchase check can still send a real purchase to the owner.
    /// </summary>
    [JsonPropertyName("if_you_buy_one")]
    public required RulesPreview IfYouBuyOne { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
