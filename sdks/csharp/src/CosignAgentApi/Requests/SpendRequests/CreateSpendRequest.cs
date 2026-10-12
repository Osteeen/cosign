using System.ComponentModel.DataAnnotations;
using CosignAgentApi.Models;

namespace CosignAgentApi.Requests.SpendRequests;

/// <summary>
/// The inputs of the CreateSpendRequest operation.
/// </summary>
public sealed record CreateSpendRequest
{
    /// <summary>
    /// Unique per purchase. Reuse it only to retry the same request. A UUID works.
    /// </summary>
    [RegularExpression("^[A-Za-z0-9_-]{16,64}$")]
    public required string IdempotencyKey { get; init; }

    /// <summary>
    /// The store, the cart, its total and the agent's reason for buying.
    /// </summary>
    public required SpendRequestCreate Body { get; init; }
}
