using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// The outcome and every reason behind it.
/// </summary>
public record Decision
{
    /// <summary>
    /// What the rules (and the AI check) decided.
    /// </summary>
    [JsonPropertyName("outcome")]
    public required DecisionOutcome Outcome { get; init; }

    /// <summary>
    /// Empty when the purchase was simply allowed.
    /// </summary>
    [JsonPropertyName("reasons")]
    public required IReadOnlyList<Reason> Reasons { get; init; }

    /// <summary>
    /// Version of the slip's rules used. Null when there was no slip.
    /// </summary>
    [JsonPropertyName("rule_version")]
    public required int? RuleVersion { get; init; }

    /// <summary>
    /// The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it to the owner.
    /// </summary>
    [JsonPropertyName("intent_check")]
    public required IntentCheck IntentCheck { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
