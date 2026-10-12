using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Errors;

public sealed class GetAllowanceError : ApiError
{
    private readonly Optional<RawError> _noContentValue;

    private GetAllowanceError(Optional<RawError> noContentValue, Optional<RawError> fallback) : base(fallback)
    {
        _noContentValue = noContentValue;
    }

    private static GetAllowanceError AsNoContent(RawError value) => new(Optional<RawError>.Some(value), default);

    private static GetAllowanceError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetNoContent(out RawError value) => _noContentValue.TryGetValue(out value);

    private static Task<GetAllowanceError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            401 or 500 => response.RawBody().As(AsNoContent),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<GetAllowanceError> Response { get; } = new(Create);
}
