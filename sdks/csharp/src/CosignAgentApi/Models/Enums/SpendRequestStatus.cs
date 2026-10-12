using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// <list type="bullet">
///   <item><description><c>PROCESSING</c> - allowed; the PayPal capture is not confirmed yet. Poll.</description></item>
///   <item><description><c>COMPLETED</c> - paid.</description></item>
///   <item><description><c>PENDING_APPROVAL</c> - waiting for the owner.</description></item>
///   <item><description><c>DENIED</c> - blocked by the rules, or declined by the owner.</description></item>
///   <item><description><c>APPROVAL_EXPIRED</c> - the owner did not decide in time. Nothing was charged.</description></item>
///   <item><description><c>PAYMENT_FAILED</c> - PayPal refused the capture. Nothing was charged.</description></item>
/// </list>
/// </summary>
[JsonConverter(typeof(StringEnumConverter<SpendRequestStatus>))]
public sealed record SpendRequestStatus : OpenStringEnum<SpendRequestStatus>
{
    private SpendRequestStatus(string value) : base(value)
    {
    }

    public static readonly SpendRequestStatus Processing = new("PROCESSING");

    public static readonly SpendRequestStatus Completed = new("COMPLETED");

    public static readonly SpendRequestStatus PendingApproval = new("PENDING_APPROVAL");

    public static readonly SpendRequestStatus Denied = new("DENIED");

    public static readonly SpendRequestStatus ApprovalExpired = new("APPROVAL_EXPIRED");

    public static readonly SpendRequestStatus PaymentFailed = new("PAYMENT_FAILED");

    public TResult Match<TResult>(Func<TResult> onProcessing,
        Func<TResult> onCompleted,
        Func<TResult> onPendingApproval,
        Func<TResult> onDenied,
        Func<TResult> onApprovalExpired,
        Func<TResult> onPaymentFailed,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Processing => onProcessing(),
            _ when this == Completed => onCompleted(),
            _ when this == PendingApproval => onPendingApproval(),
            _ when this == Denied => onDenied(),
            _ when this == ApprovalExpired => onApprovalExpired(),
            _ when this == PaymentFailed => onPaymentFailed(),
            _ => otherwise(Value)
        };

    public void Match(Action onProcessing,
        Action onCompleted,
        Action onPendingApproval,
        Action onDenied,
        Action onApprovalExpired,
        Action onPaymentFailed,
        Action<string> otherwise)
    {
        if (this == Processing) onProcessing();
        else if (this == Completed) onCompleted();
        else if (this == PendingApproval) onPendingApproval();
        else if (this == Denied) onDenied();
        else if (this == ApprovalExpired) onApprovalExpired();
        else if (this == PaymentFailed) onPaymentFailed();
        else otherwise(Value);
    }
}
