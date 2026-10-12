import {
  decodeResponse,
  type AnyResponseDecoder,
  type BinaryResponseDecoder,
  type ResponseDecoder,
} from "./response-decoder.js";
import { CoreError, DecodeError, ResponseErrorBase, type ResponseErrorInit } from "./errors.js";
import type { HttpMethod } from "./api-request.js";

/**
 * An error body the spec describes, tagged with the arm name to narrow on.
 *
 * @remarks
 * `kind` is the arm name the operation's error class declares. Narrow `err.payload.kind` and
 * `body` is typed for that arm, with no cast.
 */
export type Declared<K extends string, B> = {
  readonly kind: K;
  readonly body: B;
};

/**
 * An error body the spec does not describe: the server answered with a status no matcher covers.
 *
 * @remarks
 * The untouched bytes come back as `rawBody` so the failure stays diagnosable. A status the spec
 * *does* describe whose body fails to decode is **not** this and throws `DecodeError`, because
 * shape drift on a declared status is a contract violation rather than an open error.
 *
 * The `"default"` arm is the exception. It describes no status in particular, so a body that does
 * not fit it degrades to this arm instead of throwing.
 */
export type Undeclared = {
  readonly kind: "undeclared";
  readonly rawBody: ArrayBuffer;
};

/** The error body of a response: a {@link Declared} arm, or {@link Undeclared}. */
export type ErrorPayload<P = never> = P | Undeclared;

export type AnyPayload = ErrorPayload<Declared<string, unknown>>;

/** What an {@link ApiError} is built with: the call it names, and the answer the API gave. */
export type ApiErrorInit<Payload = Undeclared> = ResponseErrorInit & {
  readonly payload: Payload;
};

/**
 * An error answer from the API.
 *
 * @remarks
 * Thrown when the server responded with an error status. It is a `ResponseError`, so a `catch` for
 * everything the server had a say in sees it beside `DecodeError`, and it is a `CoreError`, so one
 * `instanceof AcmeError` catches it too. An operation that declares error bodies throws a subclass
 * redeclaring `payload` as a typed union; the rest throw this class directly.
 *
 * On this class `payload.kind` is `string`, so comparing it to `"undeclared"` does not narrow and
 * `"rawBody" in payload` does. A subclass declares a union of literals, which narrows on its own.
 */
export class ApiError extends ResponseErrorBase {
  readonly kind = "api" as const;

  /** The error body, as the arm the spec declared for this status, or `"undeclared"`. */
  readonly payload: AnyPayload;

  constructor(init: ApiErrorInit<AnyPayload>) {
    super(`${init.method} ${init.uri} failed with ${init.status}`, init);
    this.payload = init.payload;
  }
}

type StatusPattern = number | "1XX" | "2XX" | "3XX" | "4XX" | "5XX" | "default" | readonly [number, number];

export type AnyApiError = ApiError;

export type PayloadOf<E extends AnyApiError> = E["payload"];

type AnyMatcher = {
  readonly on: StatusPattern;
  readonly kind: string;
  readonly decode: Exclude<AnyResponseDecoder, BinaryResponseDecoder>;
};

type ErrorMatcher<D> = D extends { kind: infer K extends string; body: infer B }
  ? {
      readonly on: StatusPattern;
      readonly kind: K;
      readonly decode: Exclude<ResponseDecoder<B>, BinaryResponseDecoder>;
    }
  : never;

export type ErrorDecoders<E extends AnyApiError> = readonly ErrorMatcher<PayloadOf<E>>[];

export type ErrorFactory<E extends AnyApiError> = (new (init: ApiErrorInit<PayloadOf<E>>) => E) & {
  readonly errors?: ErrorDecoders<E> | undefined;
};

export type ResponseHandler<T = unknown, E extends AnyApiError = AnyApiError> = {
  success: ResponseDecoder<T>;
  errorFactory: ErrorFactory<E>;
};

export async function decodeErrorPayload(
  response: Response,
  matchers: readonly AnyMatcher[] | undefined,
  status: number,
  method: HttpMethod,
  uri: string,
): Promise<AnyPayload> {
  const matcher =
    matchers?.find((m) => m.on === status) ??
    matchers?.find((m) => typeof m.on !== "number" && m.on !== "default" && matchesStatus(m.on, status));

  if (matcher) {
    return { kind: matcher.kind, body: await decodeResponse(matcher.decode, response, method, uri) };
  }

  const fallback = matchers?.find((m) => m.on === "default");
  const rawBody = await readRawBody(response, method, uri);
  if (fallback === undefined) return { kind: "undeclared", rawBody };

  try {
    const unread = new Response(rawBody, { headers: response.headers });
    return { kind: fallback.kind, body: await decodeResponse(fallback.decode, unread, method, uri) };
  } catch (err) {
    if (!(err instanceof DecodeError)) throw err;
    return { kind: "undeclared", rawBody };
  }
}

async function readRawBody(response: Response, method: HttpMethod, uri: string): Promise<ArrayBuffer> {
  try {
    return await response.arrayBuffer();
  } catch (err) {
    if (err instanceof CoreError) throw err;
    throw new DecodeError(`${method} ${uri} failed: Response body could not be read.`, {
      cause: err,
      method,
      uri,
      status: response.status,
      headers: response.headers,
    });
  }
}

function matchesStatus(pattern: StatusPattern, status: number): boolean {
  if (typeof pattern === "number") return pattern === status;
  if (typeof pattern === "string") return `${Math.floor(status / 100)}XX` === pattern;
  return status >= pattern[0] && status <= pattern[1];
}
