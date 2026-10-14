using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// A request to pay, and what Cosign decided.
/// </summary>
public record SpendRequest
{
    /// <summary>
    /// The spend request's ID.
    /// </summary>
    [JsonPropertyName("id")]
    public required Guid Id { get; init; }

    /// <summary>
    /// The agent that asked.
    /// </summary>
    [JsonPropertyName("agent_id")]
    public required Guid AgentId { get; init; }

    /// <summary>
    /// The store to be paid.
    /// </summary>
    [JsonPropertyName("store_id")]
    public required Guid StoreId { get; init; }

    /// <summary>
    /// The cart as sent.
    /// </summary>
    [JsonPropertyName("items")]
    public required IReadOnlyList<LineItem> Items { get; init; }

    /// <summary>
    /// An amount of money in integer cents.
    /// </summary>
    [JsonPropertyName("total")]
    public required Money Total { get; init; }

    /// <summary>
    /// The agent's reason, as sent.
    /// </summary>
    [JsonPropertyName("purpose")]
    public required string Purpose { get; init; }

    /// <summary>
    /// - <c>PROCESSING</c> - allowed; the PayPal capture is not confirmed yet. Poll.
    ///   PayPal's own notification (webhook) settles it if the first answer was lost.
    /// - <c>COMPLETED</c> - paid. In rare cases PayPal accepts a capture as pending and
    ///   denies it later; the request then becomes <c>PAYMENT_FAILED</c>.
    /// - <c>PENDING_APPROVAL</c> - waiting for the owner.
    /// - <c>DENIED</c> - blocked by the rules, or declined by the owner.
    /// - <c>APPROVAL_EXPIRED</c> - the owner did not decide in time. Nothing was charged.
    /// - <c>PAYMENT_FAILED</c> - PayPal refused the capture. Nothing was charged.
    /// </summary>
    [JsonPropertyName("status")]
    public required SpendRequestStatus Status { get; init; }

    /// <summary>
    /// The outcome and every reason behind it.
    /// </summary>
    [JsonPropertyName("decision")]
    public required Decision Decision { get; init; }

    /// <summary>
    /// SHA-256 of the canonical cart. The owner's approval is bound to it.
    /// </summary>
    [JsonPropertyName("cart_hash")]
    public required string CartHash { get; init; }

    /// <summary>
    /// When an owner approval would expire; null unless waiting for the owner.
    /// </summary>
    [JsonPropertyName("approval_expires_at")]
    public required DateTimeOffset? ApprovalExpiresAt { get; init; }

    /// <summary>
    /// Filled in when the request is COMPLETED.
    /// </summary>
    [JsonPropertyName("receipt")]
    public required Receipt? Receipt { get; init; }

    /// <summary>
    /// When the agent asked.
    /// </summary>
    [JsonPropertyName("created_at")]
    public required DateTimeOffset CreatedAt { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
