using System;

namespace CosignAgentApi.Requests.SpendRequests;

/// <summary>
/// The inputs of the GetSpendRequest operation.
/// </summary>
public sealed record GetSpendRequest
{
    /// <summary>
    /// The <c>id</c> of a spend request this agent created.
    /// </summary>
    public required Guid SpendRequestId { get; init; }
}
