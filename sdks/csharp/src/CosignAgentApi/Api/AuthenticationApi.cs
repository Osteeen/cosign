using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using CosignAgentApi.Core;
using CosignAgentApi.Core.Exceptions;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Core.Request;
using CosignAgentApi.Core.Response;
using CosignAgentApi.Errors;
using CosignAgentApi.Models;

namespace CosignAgentApi.Api;

/// <summary>
/// Exchange the agent's API key for a short-lived token.
/// </summary>
public sealed class AuthenticationApi
{
    private readonly RawClient _rawClient;
    private readonly Server _server;
    private readonly AuthSchemes _auth;

    internal AuthenticationApi(RawClient rawClient, Server server, AuthSchemes auth)
    {
        _rawClient = rawClient;
        _server = server;
        _auth = auth;
    }

    /// <summary>
    /// Get an access token
    /// </summary>
    /// <param name="requestOptions">Per-request options, such as an overriding log level for this call</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A <see cref="Task{TResult}"/> of <see cref="AgentToken"/> instance.</returns>
    /// <exception cref="ApiException{TError}"> of <see cref="CreateTokenError"/> when the server returns an error response.</exception>
    /// <remarks>
    /// Send the agent's API key with HTTP Basic auth. The key looks like
    /// <c>key_&lt;24 hex&gt;:cs_&lt;secret&gt;</c>: the part before the colon is the username,
    /// the part after is the password. The owner sees the key once, when the
    /// agent is added.
    /// <para>
    /// Tokens last 15 minutes (<c>expires_in: 900</c>). Get a new one when a call
    /// returns <c>401</c>. A paused or revoked agent cannot get a token.
    /// </para>
    /// </remarks>
    public Task<AgentToken> CreateToken(RequestOptions? requestOptions = null,
        CancellationToken cancellationToken = default) =>
        _rawClient.Execute(
            _server.Default("/agent/token"),
            [],
            [],
            [new HeaderParam("Idempotency-Key", Guid.NewGuid())],
            HttpMethod.Post,
            EmptyBody.Instance,
            JsonResponse.Create<AgentToken>(),
            CreateTokenError.Response,
            [_auth.AgentKey],
            requestOptions,
            cancellationToken);
}
