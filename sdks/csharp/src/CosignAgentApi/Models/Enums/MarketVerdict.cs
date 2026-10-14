using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// How a price compares with like-for-like listings; <c>none</c> when no listing was comparable.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<MarketVerdict>))]
public sealed record MarketVerdict : OpenStringEnum<MarketVerdict>
{
    private MarketVerdict(string value) : base(value)
    {
    }

    public static readonly MarketVerdict Below = new("below");

    public static readonly MarketVerdict About = new("about");

    public static readonly MarketVerdict Above = new("above");

    public static readonly MarketVerdict None = new("none");

    public TResult Match<TResult>(Func<TResult> onBelow,
        Func<TResult> onAbout,
        Func<TResult> onAbove,
        Func<TResult> onNone,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Below => onBelow(),
            _ when this == About => onAbout(),
            _ when this == Above => onAbove(),
            _ when this == None => onNone(),
            _ => otherwise(Value)
        };

    public void Match(Action onBelow, Action onAbout, Action onAbove, Action onNone, Action<string> otherwise)
    {
        if (this == Below) onBelow();
        else if (this == About) onAbout();
        else if (this == Above) onAbove();
        else if (this == None) onNone();
        else otherwise(Value);
    }
}
