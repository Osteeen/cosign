using System;
using System.Collections.Generic;
using System.Linq;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core;

internal sealed class QueryParameterFactory
{
    private readonly IReadOnlyCollection<Param> _defaultQueryParams;

    public QueryParameterFactory(IReadOnlyCollection<Param> defaultQueryParams) =>
        _defaultQueryParams = defaultQueryParams;

    public string Serialize(IReadOnlyCollection<Param> queryParams)
    {
        var totalParams = _defaultQueryParams.Concat(queryParams);
        var parts = GenerateParts(totalParams);
        return string.Join("&", parts);
    }

    private static IEnumerable<string> GenerateParts(IEnumerable<Param> queryParams)
    {
        foreach (var queryParam in queryParams)
        {
            var flattened = ParameterFlattener.Flatten(queryParam);

            foreach (var f in flattened) yield return $"{Uri.EscapeDataString(f.Key)}={Uri.EscapeDataString(f.Value)}";
        }
    }
}