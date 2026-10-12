using System;
using System.Text;

namespace CosignAgentApi.Core.Authentication.Basic;

public sealed class BasicAuthCredentials
{
    public required string Username { get; init; }
    public required string Password { get; init; }

    public string Encode()
    {
        var raw = $"{Username}:{Password}";
        var bytes = Encoding.UTF8.GetBytes(raw);
        return Convert.ToBase64String(bytes);
    }
}
