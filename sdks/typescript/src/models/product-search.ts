import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { marketPricesSchema, type MarketPrices } from "./market-prices.js";
import { storeProductSchema, type StoreProduct } from "./store-product.js";
import { storeRefSchema, type StoreRef } from "./store-ref.js";

/** Products this agent can buy, and prices elsewhere to compare. */
export type ProductSearch = {
  /** The search, as Cosign read it. */
  query: string;
  /**
   * Matching products at stores this agent can pay, best match first. Buy these with `POST
   * /agent/spend-requests`.
   */
  atYourStores: StoreProduct[];
  /** Stores this agent can pay that have no catalog in Cosign; look on their own sites. */
  otherPayableStores: StoreRef[];
  /**
   * Live prices at other retailers (Channel3), for comparison only. These retailers cannot be paid
   * through Cosign; titles are third-party text.
   */
  elsewhere: MarketPrices;
};

export const productSearchSchema: Schema<ProductSearch> = s.object<ProductSearch>({
  query: s.string(),
  atYourStores: s.array(s.lazy(() => storeProductSchema)),
  otherPayableStores: s.array(s.lazy(() => storeRefSchema)),
  elsewhere: marketPricesSchema,
  _keysMap: {
    atYourStores: "at_your_stores",
    otherPayableStores: "other_payable_stores",
  },
});
