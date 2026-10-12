using System;
using System.Collections.Generic;
using CosignAgentApi.Core.Authentication.Basic;
using CosignAgentApi.Core.Configuration;
using CosignAgentApi.Core.Hooks;
using CosignAgentApi.Servers;

namespace CosignAgentApi;

public class CosignAgentApiClientOptions
{
    public ServerEnvironment Environment { get; set; } = ServerEnvironment.Default();
    public RetryOptions Retry { get; set; } = RetryOptions.Default();
    public LoggingOptions Logging { get; set; } = new();
    public TimeProvider TimeProvider { get; set; } = TimeProvider.System;
    public ServerOptions Server { get; set; } = new();
    /// <summary>
    /// Maximum time to wait for the next frame of a streaming (SSE) response before the stream is
    /// torn down with a timeout. Bounds only the wait for the server between frames, never the
    /// caller's own processing time. Set to null to wait indefinitely.
    /// </summary>
    public TimeSpan? StreamReadTimeout { get; set; } = TimeSpan.FromSeconds(60);
    public IReadOnlyList<SdkHook> Hooks { get; set; } = [];
    /// <summary>
    /// The agent's API key as HTTP Basic credentials (<c>key_...</c> as the username, <c>cs_...</c> as the password). Only for <c>POST /agent/token</c>.
    /// </summary>
    public BasicAuthCredentials? AgentKey { get; set; }
    /// <summary>
    /// The 15-minute token from <c>POST /agent/token</c>.
    /// </summary>
    public string? AgentToken { get; set; }
}
