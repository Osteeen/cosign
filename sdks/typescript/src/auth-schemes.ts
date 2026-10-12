import type { ClientOptions } from "./client-options.js";
import type { AuthScheme } from "./core/api-request.js";
import { basicAuth, bearerAuth } from "./core/auth/schemes.js";

export type AuthSchemes = {
  readonly agentKey: AuthScheme;
  readonly agentToken: AuthScheme;
};

export function buildAuthSchemes(options: ClientOptions): AuthSchemes {
  return {
    agentKey: basicAuth(options.agentKey),
    agentToken: bearerAuth(options.agentToken),
  };
}
