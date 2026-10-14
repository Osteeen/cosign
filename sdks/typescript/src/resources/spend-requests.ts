import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type ErrorDecoders, type ErrorPayload } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import * as s from "../core/validation/index.js";
import { problemSchema, type Problem } from "../models/problem.js";
import { spendRequestCreateSchema, type SpendRequestCreate } from "../models/spend-request-create.js";
import { spendRequestListSchema, type SpendRequestList } from "../models/spend-request-list.js";
import { spendRequestSchema, type SpendRequest } from "../models/spend-request.js";
import type { Servers } from "../servers.js";

/**
 * Ask to pay a store, and follow up on earlier requests.
 */
export class SpendRequests {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Ask to pay a store
   *
   * @remarks
   * Cosign checks the purchase against the slip and answers inside this request:
   *
   * - **Paid** (`status: COMPLETED`) - the rules allowed it and the AI check raised nothing. PayPal
   *   captured the total from the store's budget hold; `receipt` is filled in.
   * - **Waiting for the owner** (`status: PENDING_APPROVAL`) - over the owner's approval amount, or
   *   flagged by the AI check. The owner is emailed. Poll `GET
   *   /agent/spend-requests/{spendRequestId}`; the owner approves the exact cart (then it is paid),
   *   declines it, or lets it expire after 24 hours.
   * - **Blocked** (`status: DENIED`) - see `decision.reasons`. Nothing is charged.
   *
   * If PayPal does not answer in time the request stays `PROCESSING`; poll it, and Cosign finishes
   * the capture with the same PayPal request ID, so it is never charged twice.
   *
   * @returns A retry with an Idempotency-Key already used for this exact request. Returns the
   * original result unchanged.
   *
   * @throws {@link SpendRequests.CreateSpendRequestError} when the API answers with an error status
   * — narrow on `err.payload.kind`
   *
   * @throws {@link CosignAgentApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createSpendRequest(
    request: SpendRequests.CreateSpendRequestRequest,
    options?: RequestOptions,
  ): ApiPromise<SpendRequest, SpendRequests.CreateSpendRequestError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/agent/spend-requests"),
        auth: this.#auth.agentToken,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: request.idempotencyKey, schema: s.string() }],
        body: { kind: "json", value: request.body, schema: spendRequestCreateSchema },
      },
      {
        success: { kind: "json", schema: spendRequestSchema },
        errorFactory: SpendRequests.CreateSpendRequestError,
      },
      options,
    );
  }

  /**
   * Get a spend request
   *
   * @remarks
   * One of this agent's requests. Poll it while it is `PENDING_APPROVAL` or `PROCESSING` (every few
   * seconds is fine).
   *
   * @returns The spend request
   *
   * @throws {@link SpendRequests.GetSpendRequestError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link CosignAgentApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  getSpendRequest(
    request: SpendRequests.GetSpendRequestRequest,
    options?: RequestOptions,
  ): ApiPromise<SpendRequest, SpendRequests.GetSpendRequestError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/agent/spend-requests/{spendRequestId}"),
        auth: this.#auth.agentToken,
        pathParams: [{ name: "spendRequestId", value: request.spendRequestId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: spendRequestSchema },
        errorFactory: SpendRequests.GetSpendRequestError,
      },
      options,
    );
  }

  /**
   * List the agent's spend requests
   *
   * @remarks
   * This agent's own requests, newest first. Not paginated yet; `next_cursor` is always `null` in
   * this version.
   *
   * @returns The most recent spend requests
   *
   * @throws {@link SpendRequests.ListSpendRequestsError} when the API answers with an error status
   * — narrow on `err.payload.kind`
   *
   * @throws {@link CosignAgentApiError} when no usable response was produced: a connection failure,
   * a timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listSpendRequests(
    request: SpendRequests.ListSpendRequestsRequest,
    options?: RequestOptions,
  ): ApiPromise<SpendRequestList, SpendRequests.ListSpendRequestsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/agent/spend-requests"),
        auth: this.#auth.agentToken,
        pathParams: [],
        query: [{ name: "limit", value: request.limit, schema: s.defaulted(s.int(), 25) }],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: spendRequestListSchema },
        errorFactory: SpendRequests.ListSpendRequestsError,
      },
      options,
    );
  }
}

export namespace SpendRequests {
  export type CreateSpendRequestRequest = {
    /** Unique per purchase. Reuse it only to retry the same request. A UUID works. */
    idempotencyKey: string;
    /** The store, the cart, its total and the agent's reason for buying. */
    body: SpendRequestCreate;
  };

  export class CreateSpendRequestError extends ApiError {
    declare readonly payload: ErrorPayload<
      | Declared<"problem", Problem>
      | Declared<"problem2", Problem>
      | Declared<"problem3", Problem>
      | Declared<"problem4", Problem>
      | Declared<"problem5", Problem>
    >;

    static readonly errors: ErrorDecoders<CreateSpendRequestError> = [
      { on: 400, kind: "problem", decode: { kind: "json", schema: problemSchema } },
      { on: 401, kind: "problem2", decode: { kind: "json", schema: problemSchema } },
      { on: 409, kind: "problem3", decode: { kind: "json", schema: problemSchema } },
      { on: 429, kind: "problem4", decode: { kind: "json", schema: problemSchema } },
      { on: 500, kind: "problem5", decode: { kind: "json", schema: problemSchema } },
    ];
  }

  export type GetSpendRequestRequest = {
    /** The `id` of a spend request this agent created. */
    spendRequestId: string;
  };

  export class GetSpendRequestError extends ApiError {
    declare readonly payload: ErrorPayload<
      Declared<"problem", Problem> | Declared<"problem2", Problem> | Declared<"problem3", Problem>
    >;

    static readonly errors: ErrorDecoders<GetSpendRequestError> = [
      { on: 401, kind: "problem", decode: { kind: "json", schema: problemSchema } },
      { on: 404, kind: "problem2", decode: { kind: "json", schema: problemSchema } },
      { on: 500, kind: "problem3", decode: { kind: "json", schema: problemSchema } },
    ];
  }

  export type ListSpendRequestsRequest = {
    /** How many to return, newest first. @default 25 */
    limit?: number;
  };

  export class ListSpendRequestsError extends ApiError {
    declare readonly payload: ErrorPayload<Declared<"problem", Problem> | Declared<"problem2", Problem>>;

    static readonly errors: ErrorDecoders<ListSpendRequestsError> = [
      { on: 401, kind: "problem", decode: { kind: "json", schema: problemSchema } },
      { on: 500, kind: "problem2", decode: { kind: "json", schema: problemSchema } },
    ];
  }
}
