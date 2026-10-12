using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core;

internal static class ParameterFlattener
{
    public static IEnumerable<KeyValuePair<string, string>> Flatten(Param param)
    {
        var element = ToElement(param.Value);
        if (param.Key is { } key)
            return Flatten(key, element, param.SerializationFormat);

        return element.ValueKind switch
        {
            JsonValueKind.Null => [],
            JsonValueKind.Object => element.EnumerateObject()
                .SelectMany(p => Flatten(p.Name, p.Value, param.SerializationFormat)),
            var kind => throw new InvalidOperationException(
                $"A keyless parameter must be an object; its value serialized as {kind}.")
        };
    }

    public static IEnumerable<string> Flatten(object? value)
    {
        var element = ToElement(value);
        return element.ValueKind switch
        {
            JsonValueKind.Null => [],
            JsonValueKind.Object => [element.GetRawText()],
            JsonValueKind.Array => element.EnumerateArray().All(IsScalar)
                ? element.EnumerateArray().Select(Text)
                : [element.GetRawText()],
            _ => [Text(element)]
        };
    }

    private static IEnumerable<KeyValuePair<string, string>> Flatten(
        string key, JsonElement element, SerializationFormat format) =>
        element.ValueKind switch
        {
            JsonValueKind.Null => [],
            JsonValueKind.Object => element.EnumerateObject()
                .SelectMany(p => Flatten($"{key}[{p.Name}]", p.Value, format)),
            JsonValueKind.Array => FlattenArray(key, element, format),
            _ => [new KeyValuePair<string, string>(key, Text(element))]
        };

    private static IEnumerable<KeyValuePair<string, string>> FlattenArray(
        string key, JsonElement array, SerializationFormat format) =>
        format switch
        {
            SerializationFormat.Indexed => array.EnumerateArray().SelectMany(
                (item, index) => Flatten($"{key}[{index}]", item, format)),
            SerializationFormat.UnIndexed => array.EnumerateArray().SelectMany(
                item => Flatten($"{key}[]", item, format)),
            SerializationFormat.Csv => [new KeyValuePair<string, string>(key, Join(array, ","))],
            SerializationFormat.Tsv => [new KeyValuePair<string, string>(key, Join(array, "\t"))],
            SerializationFormat.Psv => [new KeyValuePair<string, string>(key, Join(array, "|"))],
            _ => array.EnumerateArray().SelectMany(item => Flatten(key, item, format))
        };

    private static string Join(JsonElement array, string separator) =>
        string.Join(separator, array.EnumerateArray().Select(Text));

    private static bool IsScalar(JsonElement element) =>
        element.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array);

    private static string Text(JsonElement element) =>
        element.ValueKind switch
        {
            JsonValueKind.String => element.GetString()!,
            JsonValueKind.Null => string.Empty,
            _ => element.GetRawText()
        };

    private static JsonElement ToElement(object? value) =>
        value is JsonElement element ? element : JsonSerializer.SerializeToElement(value, JsonSerializerOptions.Web);
}
