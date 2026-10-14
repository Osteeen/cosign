using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// What the agent may know about the order a paid purchase created. The
/// store gets the items and the owner's address; the agent only sees the
/// address label and whether the store has seen or shipped it.
/// </summary>
public record OrderSummary
{
    /// <summary>
    /// <c>SENT</c> to the store, <c>SEEN</c> (the store confirmed it), <c>SHIPPED</c>, or <c>CANCELLED</c> (PayPal did not complete the payment, or it was fully refunded).
    /// </summary>
    [JsonPropertyName("status")]
    public required OrderStatus Status { get; init; }

    /// <summary>
    /// The label of the owner's address it ships to, or null when nothing ships.
    /// </summary>
    [JsonPropertyName("ships_to")]
    public required string? ShipsTo { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
