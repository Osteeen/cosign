import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type ErrorDecoders, type ErrorPayload } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import { allowanceSchema, type Allowance } from "../models/allowance.js";
import { problemSchema, type Problem } from "../models/problem.js";
import type { Servers } from "../servers.js";

/**
 * This agent's allowance - what it may spend right now.
 */
export class Agent {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Get the agent's allowance
   *
   * @remarks
   * The agent's active permission slip: what is left this period, the limits, the allowed
   * categories, and the stores it can pay right now (only stores whose PayPal budget hold the owner
   * has approved). Call this before planning a purchase. `slip` is `null` when the agent has no
   * active slip yet.
   *
   * @returns The current allowance
   *
   * @throws {@link Agent.GetAllowanceError} when the API answers with an error status — narrow on
   * `err.payload.kind`
   *
   * @throws {@link CosignAgentApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getAllowance(options?: RequestOptions): ApiPromise<Allowance, Agent.GetAllowanceError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/agent/me"),
        auth: this.#auth.agentToken,
        pathParams: [],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: allowanceSchema },
        errorFactory: Agent.GetAllowanceError,
      },
      options,
    );
  }
}

export namespace Agent {
  export class GetAllowanceError extends ApiError {
    declare readonly payload: ErrorPayload<Declared<"problem", Problem> | Declared<"problem2", Problem>>;

    static readonly errors: ErrorDecoders<GetAllowanceError> = [
      { on: 401, kind: "problem", decode: { kind: "json", schema: problemSchema } },
      { on: 500, kind: "problem2", decode: { kind: "json", schema: problemSchema } },
    ];
  }
}
