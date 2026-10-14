import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** How a price compares with like-for-like listings; `none` when no listing was comparable. */
export const MarketVerdict = {
  Below: "below",
  About: "about",
  Above: "above",
  None: "none",
} as const;
export type MarketVerdict = (typeof MarketVerdict)[keyof typeof MarketVerdict] | (string & {});

export const marketVerdictSchema: EnumSchema<MarketVerdict> = s.enumOf<MarketVerdict>(MarketVerdict);
