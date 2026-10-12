using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation;
using CosignAgentApi.Core.Validation.Attributes;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// One line of the cart.
/// </summary>
public record LineItem
{
    /// <summary>
    /// What is being bought, as the store names it.
    /// </summary>
    [JsonPropertyName("name")]
    [StringLength(120, MinimumLength = 1)]
    public required string Name { get; init; }

    /// <summary>
    /// Purchase categories a slip can allow.
    /// </summary>
    [JsonPropertyName("category")]
    public required Category Category { get; init; }

    /// <summary>
    /// How many.
    /// </summary>
    [JsonPropertyName("quantity")]
    [Minimum(1)]
    [Maximum(1000)]
    public required int Quantity { get; init; }

    /// <summary>
    /// Price of one unit in integer cents.
    /// </summary>
    [JsonPropertyName("unit_amount_cents")]
    [Minimum(1)]
    [Maximum(10000000)]
    public required long UnitAmountCents { get; init; }

    /// <summary>
    /// The product page. Shown to the owner; Cosign never fetches it.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    [JsonPropertyName("product_url")]
    [MaxLength(2048)]
    [Format(FormatKind.Uri)]
    public string? ProductUrl { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
