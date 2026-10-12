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
using CosignAgentApi.Requests.SpendRequests;

namespace CosignAgentApi.Api;

/// <summary>
/// Ask to pay a store, and follow up on earlier requests.
/// </summary>
public sealed class SpendRequests
{
    private readonly RawClient _rawClient;
    private readonly Server _server;
    private readonly AuthSchemes _auth;

    internal SpendRequests(RawClient rawClient, Server server, AuthSchemes auth)
    {
        _rawClient = rawClient;
        _server = server;
        _auth = auth;
    }

    /// <summary>
    /// Ask to pay a store
    /// </summary>
    /// <param name="request">The operation's inputs</param>
    /// <param name="requestOptions">Per-request options, such as an overriding log level for this call</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A <see cref="Task{TResult}"/> of <see cref="SpendRequest"/> instance.</returns>
    /// <exception cref="ApiException{TError}"> of <see cref="CreateSpendRequestError"/> when the server returns an error response.</exception>
    /// <remarks>
    /// Cosign checks the purchase against the slip and answers inside this
    /// request:
    /// <para>
    /// - <b>Paid</b> (<c>status: COMPLETED</c>) - the rules allowed it and the AI check
    ///   raised nothing. PayPal captured the total from the store's budget
    ///   hold; <c>receipt</c> is filled in.
    /// - <b>Waiting for the owner</b> (<c>status: PENDING_APPROVAL</c>) - over the
    ///   owner's approval amount, or flagged by the AI check. The owner is
    ///   emailed. Poll <c>GET /agent/spend-requests/{spendRequestId}</c>; the owner
    ///   approves the exact cart (then it is paid), declines it, or lets it
    ///   expire after 24 hours.
    /// - <b>Blocked</b> (<c>status: DENIED</c>) - see <c>decision.reasons</c>. Nothing is charged.
    /// </para>
    /// <para>
    /// If PayPal does not answer in time the request stays <c>PROCESSING</c>;
    /// poll it, and Cosign finishes the capture with the same PayPal request
    /// ID, so it is never charged twice.
    /// </para>
    /// </remarks>
    public Task<SpendRequest> CreateSpendRequest(CreateSpendRequest request,
        RequestOptions? requestOptions = null,
        CancellationToken cancellationToken = default) =>
        _rawClient.Execute(
            _server.Default("/agent/spend-requests"),
            [],
            [],
            [new HeaderParam("Idempotency-Key", request.IdempotencyKey)],
            HttpMethod.Post,
            JsonRequest.Create(request.Body),
            JsonResponse.Create<SpendRequest>(),
            CreateSpendRequestError.Response,
            [_auth.AgentToken],
            requestOptions,
            cancellationToken);

    /// <summary>
    /// Get a spend request
    /// </summary>
    /// <param name="request">The operation's inputs</param>
    /// <param name="requestOptions">Per-request options, such as an overriding log level for this call</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A <see cref="Task{TResult}"/> of <see cref="SpendRequest"/> instance.</returns>
    /// <exception cref="ApiException{TError}"> of <see cref="GetSpendRequestError"/> when the server returns an error response.</exception>
    /// <remarks>
    /// One of this agent's requests. Poll it while it is <c>PENDING_APPROVAL</c> or <c>PROCESSING</c> (every few seconds is fine).
    /// </remarks>
    public Task<SpendRequest> GetSpendRequest(GetSpendRequest request,
        RequestOptions? requestOptions = null,
        CancellationToken cancellationToken = default) =>
        _rawClient.Execute(
            _server.Default("/agent/spend-requests/{spendRequestId}"),
            [new TemplateParam("spendRequestId", request.SpendRequestId)],
            [],
            [],
            HttpMethod.Get,
            EmptyBody.Instance,
            JsonResponse.Create<SpendRequest>(),
            GetSpendRequestError.Response,
            [_auth.AgentToken],
            requestOptions,
            cancellationToken);

    /// <summary>
    /// List the agent's spend requests
    /// </summary>
    /// <param name="request">The operation's inputs</param>
    /// <param name="requestOptions">Per-request options, such as an overriding log level for this call</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>A <see cref="Task{TResult}"/> of <see cref="SpendRequestList"/> instance.</returns>
    /// <exception cref="ApiException{TError}"> of <see cref="ListSpendRequestsError"/> when the server returns an error response.</exception>
    /// <remarks>
    /// This agent's own requests, newest first. Not paginated yet; <c>next_cursor</c> is always <c>null</c> in this version.
    /// </remarks>
    public Task<SpendRequestList> ListSpendRequests(ListSpendRequestsRequest request,
        RequestOptions? requestOptions = null,
        CancellationToken cancellationToken = default) =>
        _rawClient.Execute(
            _server.Default("/agent/spend-requests"),
            [],
            [new Param("limit", request.Limit)],
            [],
            HttpMethod.Get,
            EmptyBody.Instance,
            JsonResponse.Create<SpendRequestList>(),
            ListSpendRequestsError.Response,
            [_auth.AgentToken],
            requestOptions,
            cancellationToken);
}
