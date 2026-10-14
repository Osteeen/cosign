using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// What the rules alone would decide for buying one of this product now. The AI purchase check can still send a real purchase to the owner.
/// </summary>
public record RulesPreview
{
    /// <summary>
    /// What the rules (and the AI check) decided.
    /// </summary>
    [JsonPropertyName("outcome")]
    public required DecisionOutcome Outcome { get; init; }

    [JsonPropertyName("reasons")]
    public required IReadOnlyList<Reason> Reasons { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
