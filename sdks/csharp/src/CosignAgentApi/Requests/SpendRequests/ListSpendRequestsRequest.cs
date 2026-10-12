using CosignAgentApi.Core.Validation.Attributes;

namespace CosignAgentApi.Requests.SpendRequests;

/// <summary>
/// The inputs of the ListSpendRequests operation.
/// </summary>
public sealed record ListSpendRequestsRequest
{
    /// <summary>
    /// How many to return, newest first.
    /// </summary>
    [Minimum(1)]
    [Maximum(100)]
    public int Limit { get; init; } = 25;
}
