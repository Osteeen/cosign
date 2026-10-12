using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// SKIPPED when the rules had already decided, or the check is not configured.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<IntentVerdict>))]
public sealed record IntentVerdict : OpenStringEnum<IntentVerdict>
{
    private IntentVerdict(string value) : base(value)
    {
    }

    public static readonly IntentVerdict Clear = new("CLEAR");

    public static readonly IntentVerdict Flagged = new("FLAGGED");

    public static readonly IntentVerdict Skipped = new("SKIPPED");

    public TResult Match<TResult>(Func<TResult> onClear,
        Func<TResult> onFlagged,
        Func<TResult> onSkipped,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Clear => onClear(),
            _ when this == Flagged => onFlagged(),
            _ when this == Skipped => onSkipped(),
            _ => otherwise(Value)
        };

    public void Match(Action onClear, Action onFlagged, Action onSkipped, Action<string> otherwise)
    {
        if (this == Clear) onClear();
        else if (this == Flagged) onFlagged();
        else if (this == Skipped) onSkipped();
        else otherwise(Value);
    }
}
