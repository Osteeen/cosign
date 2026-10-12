import type { Entry } from "./validation/schema.js";
import type { HttpMethod } from "./api-request.js";
import type { BinaryContent, BinaryErrorContent } from "./binary.js";
import { readBinary, readBinaryError } from "./binary.js";
import { CoreError, DecodeError } from "./errors.js";
import { SchemaError, decodeEntry } from "./validation/schema-error.js";

export type JsonResponseDecoder<T> = {
  readonly kind: "json";
  readonly schema: Entry<T>;
};

export type TextResponseDecoder<T> = {
  readonly kind: "text";
  readonly schema: Entry<T>;
};

export type EmptyResponseDecoder = {
  readonly kind: "empty";
};

export type BinaryResponseDecoder = {
  readonly kind: "binary";
  readonly contentType: string;
};

export type BinaryErrorResponseDecoder = {
  readonly kind: "binaryError";
};

export type ResponseDecoder<T> =
  | JsonResponseDecoder<T>
  | TextResponseDecoder<T>
  | ([T] extends [undefined] ? EmptyResponseDecoder : never)
  | ([T] extends [BinaryContent] ? BinaryResponseDecoder : never)
  | ([T] extends [BinaryErrorContent] ? BinaryErrorResponseDecoder : never);

export type AnyResponseDecoder =
  | JsonResponseDecoder<unknown>
  | TextResponseDecoder<unknown>
  | EmptyResponseDecoder
  | BinaryResponseDecoder
  | BinaryErrorResponseDecoder;

export function decodeResponse<T>(
  decoder: ResponseDecoder<T>,
  response: Response,
  method: HttpMethod,
  uri: string,
): Promise<T>;
export function decodeResponse(
  decoder: AnyResponseDecoder,
  response: Response,
  method: HttpMethod,
  uri: string,
): Promise<unknown>;
export async function decodeResponse(
  decoder: AnyResponseDecoder,
  response: Response,
  method: HttpMethod,
  uri: string,
): Promise<unknown> {
  switch (decoder.kind) {
    case "json":
      return decodeJson(decoder, response, method, uri);
    case "text":
      return decodeText(decoder, response, method, uri);
    case "empty":
      return decodeEmpty(response, method, uri);
    case "binary":
      return readBinary(decoder, response);
    case "binaryError":
      return readBinaryError(response, method, uri);
    default: {
      await response.body?.cancel().catch(() => {});
      return unknownDecoderKind(decoder);
    }
  }
}

async function decodeJson<T>(
  decoder: JsonResponseDecoder<T>,
  response: Response,
  method: HttpMethod,
  uri: string,
): Promise<T> {
  let text: string;
  try {
    text = await response.text();
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new DecodeError(`${method} ${uri} failed: Response body could not be parsed as JSON.`, {
      cause: err,
      method,
      uri,
      status: response.status,
      headers: response.headers,
    });
  }
  try {
    return decodeEntry(decoder.schema, parsed);
  } catch (err) {
    if (!(err instanceof SchemaError)) throw err;
    throw new DecodeError(`${method} ${uri} failed: Response body could not be decoded.`, {
      cause: err,
      method,
      uri,
      status: response.status,
      headers: response.headers,
    });
  }
}

async function decodeText<T>(
  decoder: TextResponseDecoder<T>,
  response: Response,
  method: HttpMethod,
  uri: string,
): Promise<T> {
  let text: string;
  try {
    text = await response.text();
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
  try {
    return decodeEntry(decoder.schema, text);
  } catch (err) {
    if (!(err instanceof SchemaError)) throw err;
    throw new DecodeError(`${method} ${uri} failed: Response body could not be decoded.`, {
      cause: err,
      method,
      uri,
      status: response.status,
      headers: response.headers,
    });
  }
}

async function decodeEmpty(response: Response, method: HttpMethod, uri: string): Promise<undefined> {
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
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
  if (bytes.byteLength > 0)
    throw new DecodeError(`${method} ${uri} failed: Expected an empty response body.`, {
      method,
      uri,
      status: response.status,
      headers: response.headers,
    });
  return undefined;
}

function unknownDecoderKind(decoder: never): never {
  const kind = (decoder as { kind?: unknown }).kind;
  throw new TypeError(`Unsupported response decoder kind: ${String(kind)}`);
}
