using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Servers;

public class DefaultOptions
{
    public ProductionOptions Production { get; set; } = new();

    internal UrlTemplate Resolve(ServerEnvironment environment, string path) =>
        environment.Match(() => new UrlTemplate(
            Production.BaseUrl,
            path,
            [TemplateParam.ForServer("host", Production.Host)]));

    public class ProductionOptions
    {
        public string BaseUrl { get; set; } = "{host}/api/v1";
        public string Host { get; set; } = "http://localhost:3001";
    }
}
