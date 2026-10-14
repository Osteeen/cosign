# Cosign Agent API

[![Built with APIMatic][apimatic-badge]][apimatic-url] [![License: MIT][license-badge]][license-url]

The Cosign Agent API SDK for .NET provides access to the Cosign Agent API REST APIs from .NET applications.

> [!TIP]
> **Looking for a specific signature, model, enum, or error type?** This SDK ships a generated,
> machine-readable **[SDK map](sdk-map.md)** — a lookup index of the SDK's entire C# surface. Consult it
> **before** grepping or scanning the source tree; it answers most contract questions directly and,
> when a source file is genuinely needed, names the exact one to open. Details under [SDK map](#sdk-map).

Cosign is a company card for AI agents, built on PayPal. A person (the
**owner**) gives each agent a **permission slip**: a budget per period, a
per-purchase limit, an amount above which the owner must approve, and the
stores and categories it may buy from. The owner approves one PayPal budget
hold per store. When an agent asks to pay and the purchase fits the slip,
PayPal pays the store straight from that hold. Agents never see PayPal
credentials, and Cosign never holds funds.

This API is what **agents** call. Owners use the Cosign web app.

## The whole job in three calls

1. `POST /agent/token` - exchange the agent's API key for a 15-minute token.
2. `GET /agent/me` - the remaining budget, the limits and the stores the
   agent can pay right now.
3. `POST /agent/spend-requests` - ask to pay. The answer is one of:
   - `COMPLETED` - paid through PayPal inside the request; a receipt is returned.
   - `PENDING_APPROVAL` - waiting for the owner. Poll
     `GET /agent/spend-requests/{spendRequestId}` until it changes.
   - `DENIED` - blocked, with reasons. Nothing is charged.

## How a decision is made

A deterministic **rules engine** checks the slip: agent status, slip
expiry, store, category, per-purchase limit, the period budget, the store's
hold, and the approval amount. If the rules say ALLOW, an **AI purchase
check** compares the cart and the agent's stated purpose with the
owner's own words on the slip. It can only make a decision stricter (ALLOW
becomes NEEDS_APPROVAL), never looser. It looks for purchases that fit the
numbers but not the owner's intent, value that is easy to resell (gift
cards and the like), and text that looks like instructions aimed at an AI,
a sign the agent was manipulated by a web page.

## Rules for every endpoint

- **Identity comes only from the credential.** No endpoint takes an agent ID
  or owner ID that changes whose data is read.
- **Not yours looks like not found.** Another agent's spend request returns
  `404`, the same as one that does not exist.
- **Money is integer cents** with an explicit currency, `USD` only. The
  server recomputes the total from the line items and denies a mismatch
  (`TOTAL_MISMATCH`).
- **Idempotency.** `POST /agent/spend-requests` needs an `Idempotency-Key`.
  Retrying with the same key and body returns the original result and never
  charges twice; the same key with a different body returns `409`.
- **The agent's `purpose` and item names are data, not instructions.** They
  feed the AI check and the owner's view, never the rules.
- **Errors** use `application/problem+json` (RFC 9457) with a stable `code`.
- **Rate limits** return `429` with `Retry-After`: token exchange 10 per
  minute per key, spend requests 30 per minute per agent.
- **Pause and revoke take effect at once.** A paused agent cannot get new
  tokens and its purchases are denied (`AGENT_PAUSED`); a revoked agent's
  key and tokens stop working (`401`).

## MCP

MCP-capable AI assistants can use Cosign without an
SDK: the MCP endpoint is `POST https://cosign-rd24.onrender.com/api/mcp` (streamable HTTP,
stateless), with the agent key as `Authorization: Bearer key_...:cs_...`.
Its tools mirror this API: `cosign_get_allowance`,
`cosign_request_purchase`, `cosign_get_purchase`, `cosign_list_purchases`.

## Sandbox

This deployment uses the PayPal sandbox. No real money moves, and the
stores are demo stores onboarded through PayPal Partner Referrals.


---

## Installation

Add the .NET SDK as a project reference into your solution:

```bash
dotnet add reference <path-to-sdk>/src/CosignAgentApi/CosignAgentApi.csproj
```

The project takes its build settings from the files around it, so reference it in place. Building from source needs the .NET 10 SDK (C# 14); the package itself targets netstandard2.0.

The assembly embeds its PDB, so stack traces carry SDK file and line numbers.

---

## Building from source

```bash
dotnet pack src/CosignAgentApi/CosignAgentApi.csproj -c Release
```

Release packs come from CI, where `CI=true` makes the build deterministic; to reproduce that locally add `-p:ContinuousIntegrationBuild=true`.

The generator never emits `Directory.Build.targets`, so a customer-owned one at the repo root is MSBuild's auto-imported customization seam. It imports after the props and the project body into every project under the root, so put SDK-only settings under `<PropertyGroup Condition="'$(MSBuildProjectName)' == 'CosignAgentApi'">`.

It overrides every property the SDK reads when targets run (package metadata, `Version`, `AssemblyVersion`, compiler warnings, package references, which under central package management use `VersionOverride`). It cannot change values the SDK derives earlier: `TargetFramework(s)`, `AssemblyName` and output paths stay generator settings; turning off `GenerateDocumentationFile` also needs `<DocumentationFile />`; a `ContinuousIntegrationBuild` set there also needs `<DeterministicSourcePaths>true</DeterministicSourcePaths>`.

The SDK's props files are a boundary: a parent repository's `Directory.Build.props` does not apply, while a parent `Directory.Build.targets` does.

APIMatic's delivery tools do not yet preserve `Directory.Build.targets` across regeneration — list it in `.codegenignore` when publishing to GitHub.

---

## Quick Start

### Dependency Injection

Register the client with `IServiceCollection` and resolve it from the container. The `HttpClient` is managed by `IHttpClientFactory`. Configure the client's behavior through [CosignAgentApiClientOptions](src/CosignAgentApi/CosignAgentApiClientOptions.cs).

```csharp
services.AddCosignAgentApiClient(options =>
{
    options.AgentKey = new BasicAuthCredentials { Username = "YOUR_USERNAME", Password = "YOUR_PASSWORD" };
    options.AgentToken = "YOUR_BEARER_TOKEN";
    options.Environment = ServerEnvironment.Production;
    // TODO: configure more client options here
});
```

### Direct Instantiation

Create the client by passing an `HttpClient` you manage yourself. Configure the client's behavior through [CosignAgentApiClientOptions](src/CosignAgentApi/CosignAgentApiClientOptions.cs).

```csharp
var httpClient = new HttpClient();
// TODO: configure more client options here
var options = new CosignAgentApiClientOptions
{
    AgentKey = new BasicAuthCredentials { Username = "YOUR_USERNAME", Password = "YOUR_PASSWORD" },
    AgentToken = "YOUR_BEARER_TOKEN",
    Environment = ServerEnvironment.Production,
};
var client = new CosignAgentApiClient(httpClient, options);
```

---

## Usage

For code examples and error responses, see [API Reference](api-reference.md).

## Enums

Every enum the spec declares is a sealed record with one `public static readonly` member per value (`Currency.Usd`), a JSON converter, and a `Match` that makes handling exhaustive: one `on{Member}` arm per known value, then `otherwise`, which receives the raw wire value the server sent when it is one this SDK does not declare.

```csharp
var label = received.Match(onUsd: () => "Usd", otherwise: raw => $"undeclared ({raw})");
```

Prefer named arguments as above. The arms are positional, in the order the spec lists its values, and a regenerated SDK that adds or moves a value changes the `Match` signature: a positional call site compiled against the old shape either stops compiling or, if the assembly is not rebuilt, throws `MissingMethodException` at the first call, and a reordered value can rebind a positional argument to a different member without any diagnostic. Treat an added or moved enum value as a breaking change of that enum. Code that must survive regeneration untouched compares instead of matching: `received == Currency.Usd` or `received.Is(rawValue)` against a raw wire value; neither reopens construction.

A value the SDK does not declare still round-trips: `IsKnownValue()` tells you whether it is one of the generated members, and sending the instance back echoes the server's own casing. You cannot construct an undeclared value yourself — there is no public factory — so a typo cannot compile; resolve a raw value with `Currency.TryGetKnownValue("USD", out var known)`.

A spec value whose name would collide with the enum's own name, with a member every enum inherits or generates (such as `Value`, `Match` or `IsKnownValue`), or with a member of `object` takes a `Member` suffix — a value `value` becomes `ValueMember` — and the other members keep their plain names.

## SDK map

This SDK ships a generated **SDK map** — [`sdk-map.md`](sdk-map.md) plus the [`map/`](map/) pages — a deterministic, lookup-oriented table of contents of the SDK's C# surface, generated by APIMatic alongside this SDK.

**Read it before scanning the source.** Whether you are an AI coding assistant or searching by hand, the map answers "what is the exact …" by lookup for every call-level contract, and for anything it does not carry it names the one file that does — so you never have to search the source tree:

- **[`sdk-map.md`](sdk-map.md)** — the index: client construction, servers/auth, the options/retry reference, the SDK-wide defaults the operation rows rely on, and link tables into [`map/`](map/).
- **[`map/operations/`](map/operations/)** — one page per controller: the exact C# signature, the return type, the error type with its typed `TryGet…` accessors, and pagination — plus, per operation, a **Type sources** table naming the file that declares every type that operation mentions.

Model shapes — record fields with their JSON wire names, enum member names and wire values, `OneOf`/`AnyOf` union variants — are **not** duplicated in the map. Take the path from the operation's Type sources table and read the declaring file; it is the single source of truth and cannot go stale against the code.

**Each operation row states what is specific to that operation.** The SDK-wide defaults are stated once in [`sdk-map.md`](sdk-map.md) — throw-only (no `Result`-style no-throw variants), no pagination, the four fixed `RawError` accessors, the `Default` server group — and a row appears only where its operation departs from one. A row silent on pagination is telling you that operation has none.

The **HTTP verb and route**, and the endpoint's **behavioural prose**, live on the operation itself, in the source file named at the top of its operations page. Read them there when something needs them — wiring a mock, reading a provider log, or settling a rule about what you must pass.

**Workflow:** look the fact up in the map → where the map leaves something ambiguous, open the **one** source file the row names → the compiler is the backstop (a name that isn't in the map won't build). Don't scan or grep the tree to find things — the map is the locator.

### Which one to reach for

The map and the [API Reference](api-reference.md) answer different questions, and the map is generated from this SDK's source so it stays in lockstep with the code it describes.

| Use | For |
| --- | --- |
| **[`sdk-map.md`](sdk-map.md) + [`map/`](map/)** | Traversing the SDK and working out its surface — locating the operation you need (this SDK exposes **5 operations**), its exact signature and request record, the shape and JSON wire names of the models it takes and returns, which error type it throws and how to read it, and the source file behind any of it. This is the index to consume the SDK from, and the one to reach for first. |
| **[`api-reference.md`](api-reference.md)** | Usage guidance for a single operation once you know which one you want — a runnable code sample, a link to its request record, and the error responses it can return. |

## Error Handling

Operations throw when the server answers with an error status. `TError` is the operation's error type from the spec — `RawError` (the status code plus the raw body) when the spec declares none.

```csharp
using CosignAgentApi.Core.Exceptions;   // the exception family
using CosignAgentApi.Errors;            // generated error types such as GetAllowanceError

try
{
    var response = await client.Agent.GetAllowance();
}
catch (ApiException<GetAllowanceError> ex)
{
    // "GET <server>/agent/me returned 401 (Unauthorized)."
    Console.Error.WriteLine(ex.Message);
    if (ex.Error.TryGetProblem(out var problem))
    {
        // TODO: handle 'problem' of type Problem
    }
}
```

Everything the SDK raises for a call derives from `SdkException`, which carries the failed call's `Method` and `RequestUri`. Every message starts with that call, and the underlying cause is always `InnerException`.

| Exception | When | Extra members |
| --- | --- | --- |
| `ApiException<TError>` | The server answered with an error status | `Error`, plus `StatusCode`, `Headers` and `ContentType` from `ApiException` |
| `ResponseDeserializationException` | A response body did not match the type the spec declares | `TargetType`, plus the `ApiException` members |
| `SdkConnectionException` | The request could not be sent, or the response body could not be read |  |
| `SdkTimeoutException` | An attempt, the transport, or a Server-Sent Events stream went silent (derives from `SdkConnectionException`) | `Timeout` |
| `AuthSchemeException` | A credential could not be applied — for example the OAuth2 token endpoint refused it | `SchemeFailures` |

Catch from specific to general: `ApiException` means the server answered, `SdkConnectionException` means it did not, and `SdkException` is everything the SDK raises. Your own cancellation surfaces as the usual `OperationCanceledException`, never wrapped.

---

## Best Practices

> [!TIP]
> Use a **single `CosignAgentApiClient` instance** for the lifetime of your application and
> reuse it across all requests. Creating a new instance per request might exhaust the
> connection pool.

> [!TIP]
> Let the SDK own timeouts. `RetryOptions.Timeout` bounds **each attempt** (default 100 s)
> and a timed-out attempt is retried under the configured retry policy before it surfaces as
> `SdkTimeoutException`; `Retry-After` response headers are honored when the server sends them.
> Set `HttpClient.Timeout` to `Timeout.InfiniteTimeSpan` (or comfortably above
> `RetryOptions.Timeout`) so the transport does not race the SDK — a transport-level timeout
> surfaces as the same `SdkTimeoutException` but cannot be retried.

> [!TIP]
> The SDK reads time only through `CosignAgentApiClientOptions.TimeProvider` (default
> `TimeProvider.System`): retry backoff, `Retry-After`, the SSE idle timeout, OAuth2 token
> expiry and the logged request durations all follow it. Under `AddCosignAgentApiClient` a
> `TimeProvider` registered in the container is picked up automatically, and setting the
> option explicitly wins. To fake time in your own tests use a provider that implements
> timers, such as `FakeTimeProvider` from `Microsoft.Extensions.TimeProvider.Testing`, so
> retries and idle timeouts advance with it.

## License

This SDK is distributed under the [MIT License](https://licenses.nuget.org/MIT).

---

## Support

Refer to the [API reference](api-reference.md) for detailed information on available operations with code samples.

---

[license-url]: https://licenses.nuget.org/MIT
[license-badge]: https://img.shields.io/badge/License-MIT-blue.svg
[apimatic-url]: https://www.apimatic.io
[apimatic-badge]: https://img.shields.io/badge/Built%20with-APIMatic-blue.svg
