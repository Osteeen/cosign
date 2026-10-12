using System.Threading;
using System.Threading.Tasks;
using CosignAgentApi.Core.Models;

namespace CosignAgentApi.Core.ErrorResponse;

internal interface IErrorResponse<TError>
{
    Task<TError> Map(ResponseContext context, CancellationToken cancellationToken);
}