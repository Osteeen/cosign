import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** How to send the token. */
export const TokenType = {
  Bearer: "Bearer",
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType] | (string & {});

export const tokenTypeSchema: EnumSchema<TokenType> = s.enumOf<TokenType>(TokenType);
