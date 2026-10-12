import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { categorySchema, type Category } from "./category.js";

/** A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed. */
export type Store = {
  /** Use as `store_id` when asking to pay. */
  id: string;
  /** The store's name. */
  name: string;
  /** What the store sells. */
  categories: Category[];
  /** The store's website, where an agent can browse products. */
  website: string | null;
};

export const storeSchema: Schema<Store> = s.object<Store>({
  id: s.string(),
  name: s.string(),
  categories: s.array(s.lazy(() => categorySchema)),
  website: s.nullable(s.string()),
});
