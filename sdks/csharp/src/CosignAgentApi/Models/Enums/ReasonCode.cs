using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// Why a purchase was asked about or blocked.
/// </summary>
[JsonConverter(typeof(StringEnumConverter<ReasonCode>))]
public sealed record ReasonCode : OpenStringEnum<ReasonCode>
{
    private ReasonCode(string value) : base(value)
    {
    }

    public static readonly ReasonCode AgentPaused = new("AGENT_PAUSED");

    public static readonly ReasonCode AgentRevoked = new("AGENT_REVOKED");

    public static readonly ReasonCode NoActiveSlip = new("NO_ACTIVE_SLIP");

    public static readonly ReasonCode SlipExpired = new("SLIP_EXPIRED");

    public static readonly ReasonCode CurrencyMismatch = new("CURRENCY_MISMATCH");

    public static readonly ReasonCode TotalMismatch = new("TOTAL_MISMATCH");

    public static readonly ReasonCode StoreNotAllowed = new("STORE_NOT_ALLOWED");

    public static readonly ReasonCode NoActiveHold = new("NO_ACTIVE_HOLD");

    public static readonly ReasonCode HoldInsufficient = new("HOLD_INSUFFICIENT");

    public static readonly ReasonCode CategoryNotAllowed = new("CATEGORY_NOT_ALLOWED");

    public static readonly ReasonCode OverPerPurchaseMax = new("OVER_PER_PURCHASE_MAX");

    public static readonly ReasonCode OverPeriodBudget = new("OVER_PERIOD_BUDGET");

    public static readonly ReasonCode AboveApprovalThreshold = new("ABOVE_APPROVAL_THRESHOLD");

    public static readonly ReasonCode IntentFlagged = new("INTENT_FLAGGED");

    public TResult Match<TResult>(Func<TResult> onAgentPaused,
        Func<TResult> onAgentRevoked,
        Func<TResult> onNoActiveSlip,
        Func<TResult> onSlipExpired,
        Func<TResult> onCurrencyMismatch,
        Func<TResult> onTotalMismatch,
        Func<TResult> onStoreNotAllowed,
        Func<TResult> onNoActiveHold,
        Func<TResult> onHoldInsufficient,
        Func<TResult> onCategoryNotAllowed,
        Func<TResult> onOverPerPurchaseMax,
        Func<TResult> onOverPeriodBudget,
        Func<TResult> onAboveApprovalThreshold,
        Func<TResult> onIntentFlagged,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == AgentPaused => onAgentPaused(),
            _ when this == AgentRevoked => onAgentRevoked(),
            _ when this == NoActiveSlip => onNoActiveSlip(),
            _ when this == SlipExpired => onSlipExpired(),
            _ when this == CurrencyMismatch => onCurrencyMismatch(),
            _ when this == TotalMismatch => onTotalMismatch(),
            _ when this == StoreNotAllowed => onStoreNotAllowed(),
            _ when this == NoActiveHold => onNoActiveHold(),
            _ when this == HoldInsufficient => onHoldInsufficient(),
            _ when this == CategoryNotAllowed => onCategoryNotAllowed(),
            _ when this == OverPerPurchaseMax => onOverPerPurchaseMax(),
            _ when this == OverPeriodBudget => onOverPeriodBudget(),
            _ when this == AboveApprovalThreshold => onAboveApprovalThreshold(),
            _ when this == IntentFlagged => onIntentFlagged(),
            _ => otherwise(Value)
        };

    public void Match(Action onAgentPaused,
        Action onAgentRevoked,
        Action onNoActiveSlip,
        Action onSlipExpired,
        Action onCurrencyMismatch,
        Action onTotalMismatch,
        Action onStoreNotAllowed,
        Action onNoActiveHold,
        Action onHoldInsufficient,
        Action onCategoryNotAllowed,
        Action onOverPerPurchaseMax,
        Action onOverPeriodBudget,
        Action onAboveApprovalThreshold,
        Action onIntentFlagged,
        Action<string> otherwise)
    {
        if (this == AgentPaused) onAgentPaused();
        else if (this == AgentRevoked) onAgentRevoked();
        else if (this == NoActiveSlip) onNoActiveSlip();
        else if (this == SlipExpired) onSlipExpired();
        else if (this == CurrencyMismatch) onCurrencyMismatch();
        else if (this == TotalMismatch) onTotalMismatch();
        else if (this == StoreNotAllowed) onStoreNotAllowed();
        else if (this == NoActiveHold) onNoActiveHold();
        else if (this == HoldInsufficient) onHoldInsufficient();
        else if (this == CategoryNotAllowed) onCategoryNotAllowed();
        else if (this == OverPerPurchaseMax) onOverPerPurchaseMax();
        else if (this == OverPeriodBudget) onOverPeriodBudget();
        else if (this == AboveApprovalThreshold) onAboveApprovalThreshold();
        else if (this == IntentFlagged) onIntentFlagged();
        else otherwise(Value);
    }
}
