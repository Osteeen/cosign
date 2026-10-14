import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { marketVerdictSchema, type MarketVerdict } from "./market-verdict.js";

/** How the best match's price compares with like-for-like listings, judged by AI. */
export type MarketComparison = {
  product: string;
  /** How a price compares with like-for-like listings; `none` when no listing was comparable. */
  verdict: MarketVerdict;
  note: string;
};

export const marketComparisonSchema: Schema<MarketComparison> = s.object<MarketComparison>({
  product: s.string(),
  verdict: marketVerdictSchema,
  note: s.string(),
});
