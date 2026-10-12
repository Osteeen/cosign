namespace CosignAgentApi.Core.Models;

internal readonly record struct Param(
    string? Key,
    object? Value,
    SerializationFormat SerializationFormat = SerializationFormat.Plain)
{
    public Param(object? value) : this(null, value) { }
}
