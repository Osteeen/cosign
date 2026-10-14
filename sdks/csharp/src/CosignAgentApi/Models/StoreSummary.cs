using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// A store this agent can pay.
/// </summary>
public record StoreSummary
{
    /// <summary>
    /// Use as <c>store_id</c> when asking to pay.
    /// </summary>
    [JsonPropertyName("id")]
    public required Guid Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
