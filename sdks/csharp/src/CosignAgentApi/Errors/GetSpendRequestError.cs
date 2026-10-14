using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models;

namespace CosignAgentApi.Errors;

public sealed class GetSpendRequestError : ApiError
{
    private readonly Optional<Problem> _problemValue;

    private GetSpendRequestError(Optional<Problem> problemValue, Optional<RawError> fallback) : base(fallback)
    {
        _problemValue = problemValue;
    }

    private static GetSpendRequestError AsProblem(Problem value) => new(Optional<Problem>.Some(value), default);

    private static GetSpendRequestError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetProblem(out Problem value) => _problemValue.TryGetValue(out value);

    private static Task<GetSpendRequestError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            401 or 404 or 500 => response.Json<Problem>().As(AsProblem),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<GetSpendRequestError> Response { get; } = new(Create);
}
