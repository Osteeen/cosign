using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace CosignAgentApi.Core.Authentication;

internal sealed class NoneAuthScheme : IAuthScheme
{
    public static NoneAuthScheme Instance { get; } = new();

    private NoneAuthScheme() { }

    public ValueTask Apply(HttpRequestMessage request, CancellationToken cancellationToken) => default;
}