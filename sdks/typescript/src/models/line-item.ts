import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { categorySchema, type Category } from "./category.js";

/** One line of the cart. */
export type LineItem = {
  /** What is being bought, as the store names it. */
  name: string;
  /** Purchase categories a slip can allow. */
  category: Category;
  /** How many. */
  quantity: number;
  /** Price of one unit in integer cents. */
  unitAmountCents: number;
  /** The product page. Shown to the owner; Cosign never fetches it. */
  productUrl?: string;
};

export const lineItemSchema: Schema<LineItem> = s.object<LineItem>({
  name: s.string(),
  category: categorySchema,
  quantity: s.int(),
  unitAmountCents: s.int(),
  productUrl: s.optional(s.string()),
  _keysMap: {
    unitAmountCents: "unit_amount_cents",
    productUrl: "product_url",
  },
});
