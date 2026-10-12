import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** Purchase categories a slip can allow. */
export const Category = {
  OfficeSupplies: "office_supplies",
  Groceries: "groceries",
  FoodAndDrink: "food_and_drink",
  Travel: "travel",
  Software: "software",
  Electronics: "electronics",
  Household: "household",
  Other: "other",
} as const;
export type Category = (typeof Category)[keyof typeof Category] | (string & {});

export const categorySchema: EnumSchema<Category> = s.enumOf<Category>(Category);
