import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { moneySchema, type Money } from "./money.js";

export type MarketOffer = {
  /** The retailer's own product title (third-party text). */
  title: string;
  merchantDomain: string;
  /** An amount of money in integer cents. */
  price: Money;
};

export const marketOfferSchema: Schema<MarketOffer> = s.object<MarketOffer>({
  title: s.string(),
  merchantDomain: s.string(),
  price: moneySchema,
  _keysMap: {
    merchantDomain: "merchant_domain",
  },
});
