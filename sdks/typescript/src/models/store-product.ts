import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { categorySchema, type Category } from "./category.js";
import { moneySchema, type Money } from "./money.js";
import { rulesPreviewSchema, type RulesPreview } from "./rules-preview.js";
import { storeSummarySchema, type StoreSummary } from "./store-summary.js";

/** One product at a store this agent can pay. */
export type StoreProduct = {
  /** A store this agent can pay. */
  store: StoreSummary;
  name: string;
  /** Purchase categories a slip can allow. */
  category: Category;
  /** What one unit is. */
  unit: string;
  /** An amount of money in integer cents. */
  unitPrice: Money;
  productUrl: string;
  /**
   * What the rules alone would decide for buying one of this product now. The AI purchase check can
   * still send a real purchase to the owner.
   */
  ifYouBuyOne: RulesPreview;
};

export const storeProductSchema: Schema<StoreProduct> = s.object<StoreProduct>({
  store: storeSummarySchema,
  name: s.string(),
  category: categorySchema,
  unit: s.string(),
  unitPrice: moneySchema,
  productUrl: s.string(),
  ifYouBuyOne: rulesPreviewSchema,
  _keysMap: {
    unitPrice: "unit_price",
    productUrl: "product_url",
    ifYouBuyOne: "if_you_buy_one",
  },
});
