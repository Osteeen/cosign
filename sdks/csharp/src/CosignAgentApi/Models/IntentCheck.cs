using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it to the owner.
/// </summary>
public record IntentCheck
{
    /// <summary>
    /// SKIPPED when the rules had already decided, or the check is not configured.
    /// </summary>
    [JsonPropertyName("verdict")]
    public required IntentVerdict Verdict { get; init; }

    /// <summary>
    /// True when the check turned ALLOW into NEEDS_APPROVAL.
    /// </summary>
    [JsonPropertyName("escalated")]
    public required bool Escalated { get; init; }

    /// <summary>
    /// Why the check flagged the purchase, in plain words; null when it did not.
    /// </summary>
    [JsonPropertyName("summary")]
    [MaxLength(280)]
    public required string? Summary { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
