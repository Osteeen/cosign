using System.Collections.Generic;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Models;

/// <summary>
/// A page of spend requests, newest first.
/// </summary>
public record SpendRequestList
{
    /// <summary>
    /// The requests.
    /// </summary>
    [JsonPropertyName("data")]
    public required IReadOnlyList<SpendRequest> Data { get; init; }

    /// <summary>
    /// Always null in this version.
    /// </summary>
    [JsonPropertyName("next_cursor")]
    public required string? NextCursor { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
