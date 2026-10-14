using System.ComponentModel.DataAnnotations;
using CosignAgentApi.Core.Validation.Attributes;

namespace CosignAgentApi.Requests.Products;

/// <summary>
/// The inputs of the FindProducts operation.
/// </summary>
public sealed record FindProductsRequest
{
    /// <summary>
    /// What to look for, 2 to 120 characters.
    /// </summary>
    [StringLength(120, MinimumLength = 2)]
    public required string Q { get; init; }

    /// <summary>
    /// Most products to return from the agent's stores.
    /// </summary>
    [Minimum(1)]
    [Maximum(20)]
    public int Limit { get; init; } = 8;
}
