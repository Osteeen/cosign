import type { BasicAuthCredentials, TokenProvider } from "./core/auth/credentials.js";
import type { CoreClientOptions } from "./core/client-options.js";

export type ClientOptions = SdkClientOptions & CoreClientOptions;

type SdkClientOptions = ServerOptions & {
  /**
   * The agent's API key as HTTP Basic credentials (`key_...` as the username, `cs_...` as the
   * password). Only for `POST /agent/token`.
   */
  readonly agentKey?: BasicAuthCredentials | undefined;
  /** The 15-minute token from `POST /agent/token`. */
  readonly agentToken?: TokenProvider | undefined;
};

type ServerOptions = {
  /** Cosign deployment (PayPal sandbox) */
  readonly serverOptions?: {
    baseUrl?: string;
    /**
     * Where Cosign runs, without a trailing slash, for example https://cosign.example.com
     *
     * @default "http://localhost:3001"
     */
    host?: string;
  };
};
