import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** An amount of money in integer cents. */
export type Money = {
  /** Integer cents. 1234 = $12.34. */
  amountCents: number;
  /** ISO 4217 currency code. Only US dollars in this version. @default "USD" */
  currency?: "USD";
};

export const moneySchema: Schema<Money> = s.object<Money>({
  amountCents: s.int(),
  currency: s.defaulted(s.literal("USD"), "USD"),
  _keysMap: {
    amountCents: "amount_cents",
  },
});
