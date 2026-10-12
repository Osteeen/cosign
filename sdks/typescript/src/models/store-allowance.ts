import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { moneySchema, type Money } from "./money.js";
import { storeSchema, type Store } from "./store.js";

/** A store the agent can pay right now, and what is left in its budget hold. */
export type StoreAllowance = {
  /** A store onboarded to Cosign through PayPal Partner Referrals. PayPal IDs are never exposed. */
  store: Store;
  /** An amount of money in integer cents. */
  remainingInHold: Money;
};

export const storeAllowanceSchema: Schema<StoreAllowance> = s.object<StoreAllowance>({
  store: storeSchema,
  remainingInHold: moneySchema,
  _keysMap: {
    remainingInHold: "remaining_in_hold",
  },
});
