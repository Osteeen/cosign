using System;
using System.Text.Json.Serialization;
using CosignAgentApi.Core.Enum;

namespace CosignAgentApi.Models.Enums;

/// <summary>
/// <c>SENT</c> to the store, <c>SEEN</c> (the store confirmed it), <c>SHIPPED</c>, or <c>CANCELLED</c> (PayPal did not complete the payment, or it was fully refunded).
/// </summary>
[JsonConverter(typeof(StringEnumConverter<OrderStatus>))]
public sealed record OrderStatus : OpenStringEnum<OrderStatus>
{
    private OrderStatus(string value) : base(value)
    {
    }

    public static readonly OrderStatus Sent = new("SENT");

    public static readonly OrderStatus Seen = new("SEEN");

    public static readonly OrderStatus Shipped = new("SHIPPED");

    public static readonly OrderStatus Cancelled = new("CANCELLED");

    public TResult Match<TResult>(Func<TResult> onSent,
        Func<TResult> onSeen,
        Func<TResult> onShipped,
        Func<TResult> onCancelled,
        Func<string, TResult> otherwise) =>
        this switch
        {
            _ when this == Sent => onSent(),
            _ when this == Seen => onSeen(),
            _ when this == Shipped => onShipped(),
            _ when this == Cancelled => onCancelled(),
            _ => otherwise(Value)
        };

    public void Match(Action onSent, Action onSeen, Action onShipped, Action onCancelled, Action<string> otherwise)
    {
        if (this == Sent) onSent();
        else if (this == Seen) onSeen();
        else if (this == Shipped) onShipped();
        else if (this == Cancelled) onCancelled();
        else otherwise(Value);
    }
}
