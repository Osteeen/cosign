using System;
using System.Collections.Generic;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core;

internal sealed class UriFactory
{
    private readonly QueryParameterFactory _factory;
    private readonly TemplateParamsFactory _templateParamsFactory;

    public UriFactory(QueryParameterFactory factory, TemplateParamsFactory templateParamsFactory)
    {
        _factory = factory;
        _templateParamsFactory = templateParamsFactory;
    }

    public Uri Create(UrlTemplate urlTemplate, IReadOnlyCollection<Param> queryParameters,
        IReadOnlyCollection<TemplateParam> templateParams)
    {
        var hostPath = _templateParamsFactory.Create(urlTemplate, templateParams);

        var queryString = _factory.Serialize(queryParameters);

        return queryString.Length == 0
            ? new Uri(hostPath)
            : new Uri($"{hostPath}?{queryString}");
    }
}