import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * `SENT` to the store, `SEEN` (the store confirmed it), `SHIPPED`, or `CANCELLED` (PayPal did not
 * complete the payment, or it was fully refunded).
 */
export const OrderStatus = {
  Sent: "SENT",
  Seen: "SEEN",
  Shipped: "SHIPPED",
  Cancelled: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus] | (string & {});

export const orderStatusSchema: EnumSchema<OrderStatus> = s.enumOf<OrderStatus>(OrderStatus);
