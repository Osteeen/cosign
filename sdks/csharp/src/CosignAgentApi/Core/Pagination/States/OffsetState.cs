using System;
using System.Net.Http.Headers;

namespace CosignAgentApi.Core.Pagination.States;

internal sealed record OffsetState<TResponse> : IPageState<TResponse, OffsetState<TResponse>>
{
    private readonly long? _limit;
    private readonly Func<TResponse, int> _count;
    private readonly Func<TResponse, HttpResponseHeaders, bool?>? _hasMore;
    private readonly Func<TResponse, HttpResponseHeaders, long?>? _totalItems;

    internal OffsetState(
        long? limit,
        Func<TResponse, int> count,
        Func<TResponse, HttpResponseHeaders, bool?>? hasMore,
        Func<TResponse, HttpResponseHeaders, long?>? totalItems)
    {
        _limit = limit;
        _count = count;
        _hasMore = hasMore;
        _totalItems = totalItems;
    }

    public required long? Offset { get; init; }

    public OffsetState<TResponse>? Next(TResponse page, HttpResponseHeaders headers)
    {
        var dataCount = _count(page);
        var currentOffset = Offset ?? 0;      // normalize null start to 0
        var nextOffset = currentOffset + dataCount;

        var totalItems = _totalItems?.Invoke(page, headers);

        if (totalItems is { } total && nextOffset >= total)
            return null;

        if (nextOffset == currentOffset)
            return null;

        if (_hasMore?.Invoke(page, headers) is { } hasMore)
            return hasMore ? this with { Offset = nextOffset } : null;

        if (totalItems is null && _limit is { } limit && dataCount < limit)
            return null;

        return this with { Offset = nextOffset };
    }
}

internal static class OffsetState
{
    internal static OffsetState<TResponse> Create<TResponse>(
        long? offset,
        long? limit,
        Func<TResponse, int> count,
        Func<TResponse, HttpResponseHeaders, bool?>? hasMore = null,
        Func<TResponse, HttpResponseHeaders, long?>? totalItems = null) =>
        new(limit, count, hasMore, totalItems) { Offset = offset };
}
