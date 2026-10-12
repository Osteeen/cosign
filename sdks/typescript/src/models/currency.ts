import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** ISO 4217 currency code. Only US dollars in this version. */
export const Currency = {
  Usd: "USD",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency] | (string & {});

export const currencySchema: EnumSchema<Currency> = s.enumOf<Currency>(Currency);
