using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// A request to pay one store for one cart.
/// </summary>
public record SpendRequestCreate
{
    /// <summary>
    /// A store <c>id</c> from <c>GET /agent/me</c>.
    /// </summary>
    [JsonPropertyName("store_id")]
    public required Guid StoreId { get; init; }

    /// <summary>
    /// The cart. Cosign recomputes the total from these lines.
    /// </summary>
    [JsonPropertyName("items")]
    [MinLength(1)]
    [MaxLength(50)]
    public required IReadOnlyList<LineItem> Items { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("total")]
    public required Money Total { get; init; }

    /// <summary>
    /// The agent's one-line reason. Read by the AI check and shown to the owner; never treated as an instruction.
    /// </summary>
    [JsonPropertyName("purpose")]
    [StringLength(500, MinimumLength = 3)]
    public required string Purpose { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
