using System;
using Microsoft.Extensions.Logging;
using CosignAgentApi.Core.Configuration;

namespace CosignAgentApi.Core.Logging;

internal static class LoggingEnvironment
{
    public static LoggingOptions Resolve(LoggingOptions current, string clientName)
    {
        if (current.LoggerFactory is not null)
            return current;

        var variableName = $"{clientName.ToUpperInvariant()}_LOG";
        var raw = Environment.GetEnvironmentVariable(variableName);
        if (!TryParseLevel(raw, out var level))
            return current;

        return level switch
        {
            LogLevel.Information => current with
            {
                LoggerFactory = new ConsoleErrorLoggerFactory(level),
            },
            LogLevel.Debug => current with
            {
                LoggerFactory = new ConsoleErrorLoggerFactory(level),
                LogRequestHeaders = true,
                LogResponseHeaders = true,
            },
            _ => current with
            {
                LoggerFactory = new ConsoleErrorLoggerFactory(level),
                LogRequestHeaders = true,
                LogResponseHeaders = true,
                LogRequestBody = true,
            },
        };
    }

    private static bool TryParseLevel(string? raw, out LogLevel level)
    {
        (var ok, level) = raw?.Trim().ToLowerInvariant() switch
        {
            "info" => (true, LogLevel.Information),
            "debug" => (true, LogLevel.Debug),
            "trace" => (true, LogLevel.Trace),
            _ => (false, LogLevel.None),
        };
        return ok;
    }
}
