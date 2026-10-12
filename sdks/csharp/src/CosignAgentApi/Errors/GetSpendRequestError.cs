using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Errors;

public sealed class GetSpendRequestError : ApiError
{
    private readonly Optional<RawError> _noContentValue;

    private GetSpendRequestError(Optional<RawError> noContentValue, Optional<RawError> fallback) : base(fallback)
    {
        _noContentValue = noContentValue;
    }

    private static GetSpendRequestError AsNoContent(RawError value) => new(Optional<RawError>.Some(value), default);

    private static GetSpendRequestError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetNoContent(out RawError value) => _noContentValue.TryGetValue(out value);

    private static Task<GetSpendRequestError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            401 or 404 or 500 => response.RawBody().As(AsNoContent),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<GetSpendRequestError> Response { get; } = new(Create);
}
