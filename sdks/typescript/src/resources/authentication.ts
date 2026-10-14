import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type ErrorDecoders, type ErrorPayload } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import { uuid } from "../core/uuid.js";
import * as s from "../core/validation/index.js";
import { agentTokenSchema, type AgentToken } from "../models/agent-token.js";
import { problemSchema, type Problem } from "../models/problem.js";
import type { Servers } from "../servers.js";

/**
 * Exchange the agent's API key for a short-lived token.
 */
export class Authentication {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Get an access token
   *
   * @remarks
   * Send the agent's API key with HTTP Basic auth. The key looks like `key_<24 hex>:cs_<secret>`:
   * the part before the colon is the username, the part after is the password. The owner sees the
   * key once, when the agent is added.
   *
   * Tokens last 15 minutes (`expires_in: 900`). Get a new one when a call returns `401`. A paused
   * or revoked agent cannot get a token.
   *
   * @returns Token issued
   *
   * @throws {@link Authentication.CreateTokenError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link CosignAgentApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createToken(options?: RequestOptions): ApiPromise<AgentToken, Authentication.CreateTokenError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/agent/token"),
        auth: this.#auth.agentKey,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: uuid(), schema: s.string() }],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: agentTokenSchema },
        errorFactory: Authentication.CreateTokenError,
      },
      options,
    );
  }
}

export namespace Authentication {
  export class CreateTokenError extends ApiError {
    declare readonly payload: ErrorPayload<
      Declared<"problem", Problem> | Declared<"problem2", Problem> | Declared<"problem3", Problem>
    >;

    static readonly errors: ErrorDecoders<CreateTokenError> = [
      { on: 401, kind: "problem", decode: { kind: "json", schema: problemSchema } },
      { on: 429, kind: "problem2", decode: { kind: "json", schema: problemSchema } },
      { on: 500, kind: "problem3", decode: { kind: "json", schema: problemSchema } },
    ];
  }
}
