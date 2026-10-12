import type { ClientOptions } from "./client-options.js";
import type { ServerBase, UrlTemplate } from "./core/api-request.js";
import { resolveBaseUrl } from "./core/url.js";
import * as s from "./core/validation/index.js";

export type Servers = {
  default: <Path extends string>(subPath: Path) => UrlTemplate<Path>;
};

const serverSchemas = {
  baseUrl: s.of(s.defaulted(s.string(), "{host}/api/v1")),
  host: s.of(s.defaulted(s.string(), "http://localhost:3001")),
};

export function buildServers(options: ClientOptions): Servers {
  const base = {
    default: resolveBaseUrl(defaultServer(options)),
  };
  return {
    default: (subPath) => ({ baseUrl: base.default, subPath }),
  };
}

function defaultServer(options: ClientOptions): ServerBase {
  return {
    baseUrl: serverSchemas.baseUrl.decode(options.serverOptions?.baseUrl),
    variables: { host: serverSchemas.host.decode(options.serverOptions?.host) },
  };
}
