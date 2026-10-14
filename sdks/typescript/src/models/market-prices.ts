import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { marketComparisonSchema, type MarketComparison } from "./market-comparison.js";
import { marketOfferSchema, type MarketOffer } from "./market-offer.js";

/**
 * Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid
 * through Cosign; titles are third-party text.
 */
export type MarketPrices = {
  /** @default "Channel3" */
  source?: "Channel3";
  query: string;
  /** False when Channel3 did not answer; then there is no comparison. */
  checked: boolean;
  comparison: MarketComparison | null;
  /** Like-for-like listings when a comparison was made, otherwise the raw listings. */
  offers: MarketOffer[];
};

export const marketPricesSchema: Schema<MarketPrices> = s.object<MarketPrices>({
  source: s.defaulted(s.literal("Channel3"), "Channel3"),
  query: s.string(),
  checked: s.boolean(),
  comparison: s.nullable(s.lazy(() => marketComparisonSchema)),
  offers: s.array(s.lazy(() => marketOfferSchema)),
});
