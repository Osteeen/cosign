import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { moneySchema, type Money } from "./money.js";

/** Proof of payment for a completed request. */
export type Receipt = {
  /** Cosign's receipt ID. */
  receiptId: string;
  /** An amount of money in integer cents. */
  paid: Money;
  /** When PayPal paid the store. */
  paidAt: Date;
};

export const receiptSchema: Schema<Receipt> = s.object<Receipt>({
  receiptId: s.string(),
  paid: moneySchema,
  paidAt: s.dateTime(),
  _keysMap: {
    receiptId: "receipt_id",
    paidAt: "paid_at",
  },
});
