using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation;
using CosignAgentApi.Core.Validation.Attributes;

namespace CosignAgentApi.Models;

/// <summary>
/// An error (RFC 9457 problem details).
/// </summary>
public record ProblemError
{
    /// <summary>
    /// A URI that identifies the kind of problem.
    /// </summary>
    [JsonPropertyName("type")]
    [Format(FormatKind.Uri)]
    public required string Type { get; init; }

    /// <summary>
    /// A short, human-readable summary of the kind of problem.
    /// </summary>
    [JsonPropertyName("title")]
    public required string Title { get; init; }

    /// <summary>
    /// The HTTP status code.
    /// </summary>
    [JsonPropertyName("status")]
    public required int Status { get; init; }

    /// <summary>
    /// Stable machine-readable error code.
    /// </summary>
    [JsonPropertyName("code")]
    public required string Code { get; init; }

    /// <summary>
    /// A plain explanation.
    /// </summary>
    [JsonPropertyName("detail")]
    public required string Detail { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
