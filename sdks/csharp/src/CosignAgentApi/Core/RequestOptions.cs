using System.Collections.Generic;
using Microsoft.Extensions.Logging;
using CosignAgentApi.Core.Hooks;

namespace CosignAgentApi.Core;

public sealed record RequestOptions
{
    public LogLevel? LogLevel { get; init; }

    public IReadOnlyList<SdkHook>? Hooks { get; init; }
}
