using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// Proof of payment for a completed request.
/// </summary>
public record Receipt
{
    /// <summary>
    /// Cosign's receipt ID.
    /// </summary>
    [JsonPropertyName("receipt_id")]
    public required string ReceiptId { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("paid")]
    public required Money Paid { get; init; }

    /// <summary>
    /// When PayPal paid the store.
    /// </summary>
    [JsonPropertyName("paid_at")]
    public required DateTimeOffset PaidAt { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
