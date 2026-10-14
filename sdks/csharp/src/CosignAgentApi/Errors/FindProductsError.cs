using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models;

namespace CosignAgentApi.Errors;

public sealed class FindProductsError : ApiError
{
    private readonly Optional<Problem> _problemValue;

    private FindProductsError(Optional<Problem> problemValue, Optional<RawError> fallback) : base(fallback)
    {
        _problemValue = problemValue;
    }

    private static FindProductsError AsProblem(Problem value) => new(Optional<Problem>.Some(value), default);

    private static FindProductsError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetProblem(out Problem value) => _problemValue.TryGetValue(out value);

    private static Task<FindProductsError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            400 or 401 or 403 or 429 or 500 => response.Json<Problem>().As(AsProblem),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<FindProductsError> Response { get; } = new(Create);
}
