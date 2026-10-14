using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Validation;
using CosignAgentApi.Core.Validation.Attributes;

namespace CosignAgentApi.Models;

public record StoreRef
{
    [JsonPropertyName("id")]
    public required Guid Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("website")]
    [Format(FormatKind.Uri)]
    public required string? Website { get; init; }

    [JsonExtensionData]
    public AdditionalProperties AdditionalProperties { get; init; } = [];
}
