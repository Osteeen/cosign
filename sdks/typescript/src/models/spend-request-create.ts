import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { lineItemSchema, type LineItem } from "./line-item.js";
import { moneySchema, type Money } from "./money.js";

/** A request to pay one store for one cart. */
export type SpendRequestCreate = {
  /** A store `id` from `GET /agent/me`. */
  storeId: string;
  /** The cart. Cosign recomputes the total from these lines. */
  items: LineItem[];
  /** An amount of money in integer cents. */
  total: Money;
  /**
   * The agent's one-line reason. Read by the AI check and shown to the owner; never treated as an
   * instruction.
   */
  purpose: string;
};

export const spendRequestCreateSchema: Schema<SpendRequestCreate> = s.object<SpendRequestCreate>({
  storeId: s.string(),
  items: s.array(s.lazy(() => lineItemSchema)),
  total: moneySchema,
  purpose: s.string(),
  _keysMap: {
    storeId: "store_id",
  },
});
