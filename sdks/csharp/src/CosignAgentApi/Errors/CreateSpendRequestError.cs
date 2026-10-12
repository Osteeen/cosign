using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Errors;

public sealed class CreateSpendRequestError : ApiError
{
    private readonly Optional<RawError> _noContentValue;

    private CreateSpendRequestError(Optional<RawError> noContentValue, Optional<RawError> fallback) : base(fallback)
    {
        _noContentValue = noContentValue;
    }

    private static CreateSpendRequestError AsNoContent(RawError value) => new(Optional<RawError>.Some(value), default);

    private static CreateSpendRequestError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetNoContent(out RawError value) => _noContentValue.TryGetValue(out value);

    private static Task<CreateSpendRequestError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            400 or 401 or 409 or 429 or 500 => response.RawBody().As(AsNoContent),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<CreateSpendRequestError> Response { get; } = new(Create);
}
