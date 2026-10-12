using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Polly;
using Polly.Retry;
using Polly.Timeout;
using CosignAgentApi.Core.Configuration;
using CosignAgentApi.Core.Logging;
using CosignAgentApi.Core.Request;

namespace CosignAgentApi.Core;

internal sealed class ResiliencePipelineFactory
{
    internal static readonly ResiliencePropertyKey<HttpLogger.Scope> LogScopeKey = new("Sdk.LogScope");
    internal static readonly ResiliencePropertyKey<HttpMethod> MethodKey = new("Sdk.Method");

    internal static readonly TimeSpan MaxDelay = TimeSpan.FromMinutes(1);

    private static readonly ThreadLocal<Random> Jitterer = new(() => new Random(Guid.NewGuid().GetHashCode()));

    private readonly ResiliencePipeline<HttpResponseMessage> _pipeline;
    private readonly ResiliencePipeline<HttpResponseMessage> _timeoutOnly;

    public ResiliencePipelineFactory(RetryOptions options, TimeProvider clock)
    {
        _pipeline = CreateResiliencePipeline(options, clock);
        _timeoutOnly = options.MaxRetries <= 0
            ? _pipeline
            : CreateResiliencePipeline(options with { MaxRetries = 0 }, clock);
    }

    public ResiliencePipeline<HttpResponseMessage> Create(IRequest request) =>
        request.CanRetry ? _pipeline : _timeoutOnly;

    private static ResiliencePipeline<HttpResponseMessage> CreateResiliencePipeline(
        RetryOptions options, TimeProvider clock)
    {
        // Nothing to wrap: retries disabled (MaxRetries == 0) and no timeout → no-op pipeline.
        // Returning Empty here also keeps the builder from ever seeing zero strategies.
        if (options is { MaxRetries: <= 0, Timeout: null })
            return ResiliencePipeline<HttpResponseMessage>.Empty;

        var builder = new ResiliencePipelineBuilder<HttpResponseMessage> { TimeProvider = clock };

        // MaxRetries == 0 disables retries; Polly requires MaxRetryAttempts >= 1, so skip the
        // strategy entirely rather than passing 0 (which would throw at build time).
        if (options.MaxRetries > 0)
        {
            HashSet<HttpMethod> methodsToRetry = [.. options.HttpMethodsToRetry];
            HashSet<HttpStatusCode> statusCodesToRetry = [.. options.StatusCodesToRetry];

            builder.AddRetry(new RetryStrategyOptions<HttpResponseMessage>
            {
                ShouldHandle = args => new ValueTask<bool>(
                    args.Context.Properties.TryGetValue(MethodKey, out var method) &&
                    methodsToRetry.Contains(method) &&
                    args.Outcome switch
                    {
                        { Exception: HttpRequestException or TimeoutRejectedException } => true,
                        { Result: { } response } => statusCodesToRetry.Contains(response.StatusCode),
                        _ => false,
                    }),
                MaxRetryAttempts = options.MaxRetries,
                DelayGenerator = args =>
                {
                    if (RetryAfterDelay(args.Outcome.Result, clock.GetUtcNow()) is { } retryAfter)
                        return new ValueTask<TimeSpan?>(retryAfter);

                    return new ValueTask<TimeSpan?>(BackoffDelay(options, args.AttemptNumber, Jitterer.Value!));
                },
                OnRetry = args =>
                {
                    RetryReason reason = args.Outcome.Exception is { } ex
                        ? new RetryReason.Failure(ex)
                        : new RetryReason.Status(args.Outcome.Result!.StatusCode);

                    // Dispose the failed-attempt response to prevent socket leaks.
                    args.Outcome.Result?.Dispose();

                    if (args.Context.Properties.TryGetValue(LogScopeKey, out var scope))
                        scope.Retrying(args.AttemptNumber + 1, options.MaxRetries, args.RetryDelay, reason);

                    if (options.OnRetry is { } callback)
                        callback(new RetryAttempt
                        {
                            AttemptNumber = args.AttemptNumber + 1,
                            Delay = args.RetryDelay,
                            Reason = reason,
                        });

                    return default;
                }
            });
        }

        // Retry outer, Timeout inner → per-attempt timeout, not cumulative.
        if (options.Timeout is { } timeout)
            builder.AddTimeout(new TimeoutStrategyOptions { Timeout = timeout });

        return builder.Build();
    }

    internal static TimeSpan BackoffDelay(RetryOptions options, int attemptNumber, Random jitterer)
    {
        // AttemptNumber is 0-based, so the first retry uses BackOffFactor^0 = the base delay.
        var backoffMs = options.UseExponentialBackoff
            ? options.Delay.TotalMilliseconds * Math.Pow(options.BackOffFactor, attemptNumber)
            : options.Delay.TotalMilliseconds;

        var jitterMs = options.MaxJitter <= TimeSpan.Zero
            ? 0
            : jitterer.NextDouble() * options.MaxJitter.TotalMilliseconds;

        var totalMs = Math.Min(backoffMs + jitterMs, MaxDelay.TotalMilliseconds);
        return TimeSpan.FromMilliseconds(Math.Max(totalMs, 0));
    }

    internal static TimeSpan? RetryAfterDelay(HttpResponseMessage? response, DateTimeOffset now) =>
        response?.Headers.RetryAfter switch
        {
            { Delta: { } delta } => ClampRetryAfter(delta),
            { Date: { } date } => ClampRetryAfter(date - now),
            _ => null,
        };

    private static TimeSpan ClampRetryAfter(TimeSpan delay) =>
        delay < TimeSpan.Zero ? TimeSpan.Zero
        : delay > MaxDelay ? MaxDelay
        : delay;
}
