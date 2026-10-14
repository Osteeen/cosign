using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models;

namespace CosignAgentApi.Errors;

public sealed class CreateSpendRequestError : ApiError
{
    private readonly Optional<Problem> _problemValue;

    private CreateSpendRequestError(Optional<Problem> problemValue, Optional<RawError> fallback) : base(fallback)
    {
        _problemValue = problemValue;
    }

    private static CreateSpendRequestError AsProblem(Problem value) => new(Optional<Problem>.Some(value), default);

    private static CreateSpendRequestError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetProblem(out Problem value) => _problemValue.TryGetValue(out value);

    private static Task<CreateSpendRequestError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            400 or 401 or 409 or 429 or 500 => response.Json<Problem>().As(AsProblem),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<CreateSpendRequestError> Response { get; } = new(Create);
}
