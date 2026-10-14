using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;
using CosignAgentApi.Models;

namespace CosignAgentApi.Errors;

public sealed class GetAllowanceError : ApiError
{
    private readonly Optional<Problem> _problemValue;

    private GetAllowanceError(Optional<Problem> problemValue, Optional<RawError> fallback) : base(fallback)
    {
        _problemValue = problemValue;
    }

    private static GetAllowanceError AsProblem(Problem value) => new(Optional<Problem>.Some(value), default);

    private static GetAllowanceError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetProblem(out Problem value) => _problemValue.TryGetValue(out value);

    private static Task<GetAllowanceError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            401 or 500 => response.Json<Problem>().As(AsProblem),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<GetAllowanceError> Response { get; } = new(Create);
}
