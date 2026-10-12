using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using CosignAgentApi.Core;
using CosignAgentApi.Core.Exceptions;
using CosignAgentApi.Core.Request;
using CosignAgentApi.Core.Response;
using CosignAgentApi.Errors;
using CosignAgentApi.Models;

namespace CosignAgentApi.Api;

/// <summary>
/// This agent's allowance - what it may spend right now.
/// </summary>
public sealed class Agent
{
    private readonly RawClient _rawClient;
    private readonly Server _server;
    private readonly AuthSchemes _auth;

    internal Agent(RawClient rawClient, Server server, AuthSchemes auth)
    {
        _rawClient = rawClient;
        _server = server;
        _auth = auth;
    }

    /// <summary>
    /// Get the agent's allowance
    /// </summary>
    /// <param name="requestOptions">Per-request options, such as an overriding log level for this call</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A <see cref="Task{TResult}"/> of <see cref="Allowance"/> instance.</returns>
    /// <exception cref="ApiException{TError}"> of <see cref="GetAllowanceError"/> when the server returns an error response.</exception>
    /// <remarks>
    /// The agent's active permission slip: what is left this period, the
    /// limits, the allowed categories, and the stores it can pay right now
    /// (only stores whose PayPal budget hold the owner has approved). Call this
    /// before planning a purchase. <c>slip</c> is <c>null</c> when the agent has no
    /// active slip yet.
    /// </remarks>
    public Task<Allowance> GetAllowance(RequestOptions? requestOptions = null,
        CancellationToken cancellationToken = default) =>
        _rawClient.Execute(
            _server.Default("/agent/me"),
            [],
            [],
            [],
            HttpMethod.Get,
            EmptyBody.Instance,
            JsonResponse.Create<Allowance>(),
            GetAllowanceError.Response,
            [_auth.AgentToken],
            requestOptions,
            cancellationToken);
}
