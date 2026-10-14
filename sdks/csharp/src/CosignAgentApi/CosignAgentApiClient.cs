using System.Net.Http;
using CosignAgentApi.Api;
using CosignAgentApi.Core;
using CosignAgentApi.Core.Logging;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi;

/// <summary>
/// Cosign is a company card for AI agents, built on PayPal. A person (the
/// <b>owner</b>) gives each agent a <b>permission slip</b>: a budget per period, a
/// per-purchase limit, an amount above which the owner must approve, and the
/// stores and categories it may buy from. The owner approves one PayPal budget
/// hold per store. When an agent asks to pay and the purchase fits the slip,
/// PayPal pays the store straight from that hold. Agents never see PayPal
/// credentials, and Cosign never holds funds.
/// <para>
/// This API is what <b>agents</b> call. Owners use the Cosign web app.
/// </para>
/// <para>
/// ## The whole job in three calls
/// </para>
/// <para>
/// 1. <c>POST /agent/token</c> - exchange the agent's API key for a 15-minute token.
/// 2. <c>GET /agent/me</c> - the remaining budget, the limits and the stores the
///    agent can pay right now. Optionally, <c>GET /agent/products?q=...</c> finds
///    products at those stores, says what the rules would decide, and compares
///    prices at other retailers.
/// 3. <c>POST /agent/spend-requests</c> - ask to pay. The answer is one of:
///    - <c>COMPLETED</c> - paid through PayPal inside the request; a receipt is returned.
///    - <c>PENDING_APPROVAL</c> - waiting for the owner. Poll
///      <c>GET /agent/spend-requests/{spendRequestId}</c> until it changes.
///    - <c>DENIED</c> - blocked, with reasons. Nothing is charged.
/// </para>
/// <para>
/// ## How a decision is made
/// </para>
/// <para>
/// A deterministic <b>rules engine</b> checks the slip: agent status, slip
/// expiry, store, category, per-purchase limit, the period budget, the store's
/// hold, and the approval amount. If the rules say ALLOW, an **AI purchase
/// check** compares the cart and the agent's stated purpose with the
/// owner's own words on the slip. It can only make a decision stricter (ALLOW
/// becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
/// numbers but not the owner's intent, value that is easy to resell (gift
/// cards and the like), and text that looks like instructions aimed at an AI,
/// a sign the agent was manipulated by a web page.
/// </para>
/// <para>
/// ## Rules for every endpoint
/// </para>
/// <para>
/// - <b>Identity comes only from the credential.</b> No endpoint takes an agent ID
///   or owner ID that changes whose data is read.
/// - <b>Not yours looks like not found.</b> Another agent's spend request returns
///   <c>404</c>, the same as one that does not exist.
/// - <b>Money is integer cents</b> with an explicit currency, <c>USD</c> only. The
///   server recomputes the total from the line items and denies a mismatch
///   (<c>TOTAL_MISMATCH</c>).
/// - <b>Idempotency.</b> <c>POST /agent/spend-requests</c> needs an <c>Idempotency-Key</c>.
///   Retrying with the same key and body returns the original result and never
///   charges twice; the same key with a different body returns <c>409</c>.
/// - <b>The agent's <c>purpose</c> and item names are data, not instructions.</b> They
///   feed the AI check and the owner's view, never the rules.
/// - <b>Errors</b> use <c>application/problem+json</c> (RFC 9457) with a stable <c>code</c>.
/// - <b>Rate limits</b> return <c>429</c> with <c>Retry-After</c>: token exchange 10 per
///   minute per key, spend requests 30 per minute per agent.
/// - <b>Pause and revoke take effect at once.</b> A paused agent cannot get new
///   tokens and its purchases are denied (<c>AGENT_PAUSED</c>); a revoked agent's
///   key and tokens stop working (<c>401</c>).
/// </para>
/// <para>
/// ## MCP
/// </para>
/// <para>
/// MCP-capable AI assistants can use Cosign without an
/// SDK: the MCP endpoint is <c>POST https://cosign-rd24.onrender.com/api/mcp</c> (streamable HTTP,
/// stateless), with the agent key as <c>Authorization: Bearer key_...:cs_...</c>.
/// Its tools mirror this API: <c>cosign_get_allowance</c>, <c>cosign_find_products</c>,
/// <c>cosign_request_purchase</c>, <c>cosign_get_purchase</c>, <c>cosign_list_purchases</c>.
/// </para>
/// <para>
/// ## Sandbox
/// </para>
/// <para>
/// This deployment uses the PayPal sandbox. No real money moves, and the
/// stores are demo stores onboarded through PayPal Partner Referrals.
/// </para>
/// </summary>
public sealed class CosignAgentApiClient
{
    private readonly RawClient _rawClient;
    private readonly Server _server;
    private readonly AuthSchemes _auth;

    public CosignAgentApiClient(HttpClient httpClient, CosignAgentApiClientOptions options)
    {
        _server = new Server(options.Environment, options.Server);
        var queryParameterFactory = new QueryParameterFactory([]);
        var templateParamsFactory = new TemplateParamsFactory([]);
        var urlFactory = new UriFactory(queryParameterFactory, templateParamsFactory);
        var httpStatusPolicy = new HttpStatusPolicy([]);
        var headersFactory = new HeadersFactory([
            new HeaderParam("User-Agent", "CosignAgentApiClient/1.0.0 CSharp"),
            new HeaderParam("X-APIMatic-Lang", "CSharp"),
            new HeaderParam("X-APIMatic-Package-Version", "1.0.0"),
            new HeaderParam("X-APIMatic-Gen-Version", "4.0.0"),
            new HeaderParam("X-APIMatic-OS", RuntimeEnvironment.Os),
            new HeaderParam("X-APIMatic-Runtime", RuntimeEnvironment.Runtime),
        ]);
        var resiliencePipelineFactory = new ResiliencePipelineFactory(options.Retry, options.TimeProvider);
        var httpLogger = new HttpLogger(options.Logging, "CosignAgentApiClient", options.TimeProvider);
        var responseContexts = new ResponseContextFactory(options.TimeProvider, options.StreamReadTimeout);
        _rawClient =
            new RawClient(
                httpClient,
                urlFactory,
                httpStatusPolicy,
                headersFactory,
                resiliencePipelineFactory,
                httpLogger,
                options.Hooks,
                responseContexts);
        _auth = new AuthSchemes(options);
    }

    /// <summary>
    /// This agent's allowance - what it may spend right now.
    /// </summary>
    public Agent Agent => field ??= new Agent(_rawClient, _server, _auth);

    /// <summary>
    /// Exchange the agent's API key for a short-lived token.
    /// </summary>
    public AuthenticationApi AuthenticationApi => field ??= new AuthenticationApi(_rawClient, _server, _auth);

    /// <summary>
    /// Find products at the stores this agent can pay, and compare prices elsewhere.
    /// </summary>
    public Products Products => field ??= new Products(_rawClient, _server, _auth);

    /// <summary>
    /// Ask to pay a store, and follow up on earlier requests.
    /// </summary>
    public SpendRequests SpendRequests => field ??= new SpendRequests(_rawClient, _server, _auth);
}
