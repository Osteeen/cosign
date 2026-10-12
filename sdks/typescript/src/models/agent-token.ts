import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A short-lived token for the agent API. */
export type AgentToken = {
  /** Send it as `Authorization: Bearer <access_token>`. */
  accessToken: string;
  /** How to send the token. @default "Bearer" */
  tokenType?: "Bearer";
  /** Seconds until it expires. 900 in this version. */
  expiresIn: number;
};

export const agentTokenSchema: Schema<AgentToken> = s.object<AgentToken>({
  accessToken: s.string(),
  tokenType: s.defaulted(s.literal("Bearer"), "Bearer"),
  expiresIn: s.int(),
  _keysMap: {
    accessToken: "access_token",
    tokenType: "token_type",
    expiresIn: "expires_in",
  },
});
