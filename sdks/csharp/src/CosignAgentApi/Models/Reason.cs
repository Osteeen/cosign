using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models.Enums;

namespace CosignAgentApi.Models;

/// <summary>
/// One reason behind a decision.
/// </summary>
public record Reason
{
    /// <summary>
    /// Why a purchase was asked about or blocked.
    /// </summary>
    [JsonPropertyName("code")]
    public required ReasonCode Code { get; init; }

    /// <summary>
    /// Plain words, safe to show a person.
    /// </summary>
    [JsonPropertyName("message")]
    public required string Message { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
