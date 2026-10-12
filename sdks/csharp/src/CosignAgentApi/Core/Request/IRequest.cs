using System.Net.Http;

namespace CosignAgentApi.Core.Request;

internal interface IRequest
{
    HttpContent Get();

    bool CanRetry { get; }
}