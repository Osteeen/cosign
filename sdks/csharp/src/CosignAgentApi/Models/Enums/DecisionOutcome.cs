using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// What the rules (and the AI check) decided.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<DecisionOutcome>))]
public sealed record DecisionOutcome : OpenStringEnum<DecisionOutcome>
{
    private DecisionOutcome(string value) : base(value)
    {
    }

    public static readonly DecisionOutcome Allow = new("ALLOW");

    public static readonly DecisionOutcome NeedsApproval = new("NEEDS_APPROVAL");

    public static readonly DecisionOutcome Deny = new("DENY");

    public TResult Match<TResult>(Func<TResult> onAllow,
        Func<TResult> onNeedsApproval,
        Func<TResult> onDeny,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Allow => onAllow(),
            _ when this == NeedsApproval => onNeedsApproval(),
            _ when this == Deny => onDeny(),
            _ => otherwise(Value)
        };

    public void Match(Action onAllow, Action onNeedsApproval, Action onDeny, Action<string> otherwise)
    {
        if (this == Allow) onAllow();
        else if (this == NeedsApproval) onNeedsApproval();
        else if (this == Deny) onDeny();
        else otherwise(Value);
    }
}
