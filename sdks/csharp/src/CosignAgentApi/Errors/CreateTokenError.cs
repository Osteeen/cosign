using System.Threading.Tasks;
using CosignAgentApi.Core.ErrorResponse;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Errors;

public sealed class CreateTokenError : ApiError
{
    private readonly Optional<RawError> _noContentValue;

    private CreateTokenError(Optional<RawError> noContentValue, Optional<RawError> fallback) : base(fallback)
    {
        _noContentValue = noContentValue;
    }

    private static CreateTokenError AsNoContent(RawError value) => new(Optional<RawError>.Some(value), default);

    private static CreateTokenError AsFallback(RawError value) => new(default, Optional<RawError>.Some(value));

    public bool TryGetNoContent(out RawError value) => _noContentValue.TryGetValue(out value);

    private static Task<CreateTokenError> Create(FailedResponse response) =>
        response.StatusCode switch
        {
            401 or 429 or 500 => response.RawBody().As(AsNoContent),
            _ => response.RawBody().As(AsFallback)
        };

    internal static ApiErrorResponse<CreateTokenError> Response { get; } = new(Create);
}
