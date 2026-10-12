using System.Diagnostics;

namespace CosignAgentApi.Core.Models;

[DebuggerDisplay("{GetDebuggerDisplay(),nq}")]
internal readonly record struct Optional<TValue>
{
    [DebuggerBrowsable(DebuggerBrowsableState.Never)]
    private readonly bool _hasValue;
    [DebuggerBrowsable(DebuggerBrowsableState.Never)]
    private readonly TValue? _value;

    private Optional(TValue? value, bool hasValue)
    {
        _value = value;
        _hasValue = hasValue;
    }

    public static Optional<TValue> Some(TValue value) => new(value, true);

    public bool TryGetValue(out TValue value)
    {
        value = _value!;
        return _hasValue;
    }

    private string GetDebuggerDisplay() => _hasValue ? $"Some({_value})" : "None";
}