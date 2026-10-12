using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<AgentStatus>))]
public sealed record AgentStatus : OpenStringEnum<AgentStatus>
{
    private AgentStatus(string value) : base(value)
    {
    }

    public static readonly AgentStatus Active = new("ACTIVE");

    public static readonly AgentStatus Paused = new("PAUSED");

    public static readonly AgentStatus Revoked = new("REVOKED");

    public TResult Match<TResult>(Func<TResult> onActive,
        Func<TResult> onPaused,
        Func<TResult> onRevoked,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Active => onActive(),
            _ when this == Paused => onPaused(),
            _ when this == Revoked => onRevoked(),
            _ => otherwise(Value)
        };

    public void Match(Action onActive, Action onPaused, Action onRevoked, Action<string> otherwise)
    {
        if (this == Active) onActive();
        else if (this == Paused) onPaused();
        else if (this == Revoked) onRevoked();
        else otherwise(Value);
    }
}
