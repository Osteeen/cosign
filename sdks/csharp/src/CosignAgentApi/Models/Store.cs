using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation;
using CosignAgentApi.Core.Validation.Attributes;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed.
/// </summary>
public record Store
{
    /// <summary>
    /// Use as <c>store_id</c> when asking to pay.
    /// </summary>
    [JsonPropertyName("id")]
    public required Guid Id { get; init; }

    /// <summary>
    /// The store's name.
    /// </summary>
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    /// <summary>
    /// What the store sells.
    /// </summary>
    [JsonPropertyName("categories")]
    public required IReadOnlyList<Category> Categories { get; init; }

    /// <summary>
    /// The store's website, where an agent can browse products.
    /// </summary>
    [JsonPropertyName("website")]
    [Format(FormatKind.Uri)]
    public required string? Website { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
