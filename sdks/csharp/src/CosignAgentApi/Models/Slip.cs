using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation.Attributes;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// The agent's active permission slip, as the agent sees it.
/// </summary>
public record Slip
{
    /// <summary>
    /// The slip's ID.
    /// </summary>
    [JsonPropertyName("slip_id")]
    public required Guid SlipId { get; init; }

    /// <summary>
    /// Length of one budget period. At most 28 days, so a period fits inside one 29-day PayPal hold.
    /// </summary>
    [JsonPropertyName("period_days")]
    [Minimum(1)]
    [Maximum(28)]
    public required int PeriodDays { get; init; }

    /// <summary>
    /// When the current budget period ends.
    /// </summary>
    [JsonPropertyName("period_ends_at")]
    public required DateTimeOffset PeriodEndsAt { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("remaining_this_period")]
    public required Money RemainingThisPeriod { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("per_purchase_max")]
    public required Money PerPurchaseMax { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("approve_above")]
    public required Money ApproveAbove { get; init; }

    /// <summary>
    /// Categories the agent may buy.
    /// </summary>
    [JsonPropertyName("categories")]
    public required IReadOnlyList<Category> Categories { get; init; }

    /// <summary>
    /// When the slip ends for good, or null if the owner set no end date.
    /// </summary>
    [JsonPropertyName("expires_at")]
    public required DateTimeOffset? ExpiresAt { get; init; }

    /// <summary>
    /// Only stores with an approved budget hold for this period.
    /// </summary>
    [JsonPropertyName("stores")]
    public required IReadOnlyList<StoreAllowance> Stores { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
