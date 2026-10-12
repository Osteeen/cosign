using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// What the agent may spend right now.
/// </summary>
public record Allowance
{
    /// <summary>
    /// This agent's ID.
    /// </summary>
    [JsonPropertyName("agent_id")]
    public required Guid AgentId { get; init; }

    /// <summary>
    /// Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate.
    /// </summary>
    [JsonPropertyName("status")]
    public required AgentStatus Status { get; init; }

    /// <summary>
    /// The active permission slip, or null when the agent has none.
    /// </summary>
    [JsonPropertyName("slip")]
    public required Slip? Slip { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
