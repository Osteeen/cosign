import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { orderStatusSchema, type OrderStatus } from "./order-status.js";

/**
 * What the agent may know about the order a paid purchase created. The store gets the items and the
 * owner's address; the agent only sees the address label and whether the store has seen or shipped
 * it.
 */
export type OrderSummary = {
  /**
   * `SENT` to the store, `SEEN` (the store confirmed it), `SHIPPED`, or `CANCELLED` (PayPal did not
   * complete the payment, or it was fully refunded).
   */
  status: OrderStatus;
  /** The label of the owner's address it ships to, or null when nothing ships. */
  shipsTo: string | null;
};

export const orderSummarySchema: Schema<OrderSummary> = s.object<OrderSummary>({
  status: orderStatusSchema,
  shipsTo: s.nullable(s.string()),
  _keysMap: {
    shipsTo: "ships_to",
  },
});
