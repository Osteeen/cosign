using System;
using System.Collections.Generic;

namespace CosignAgentApi.Core.Exceptions;

public sealed class AuthSchemeException(string message, IReadOnlyList<Exception> schemeFailures)
    : SdkException(message, schemeFailures is [var only] ? only : new AggregateException(schemeFailures))
{
    public IReadOnlyList<Exception> SchemeFailures { get; } = schemeFailures;
}
