import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { categorySchema, type Category } from "./category.js";
import { moneySchema, type Money } from "./money.js";
import { storeAllowanceSchema, type StoreAllowance } from "./store-allowance.js";

/** The agent's active permission slip, as the agent sees it. */
export type Slip = {
  /** The slip's ID. */
  slipId: string;
  /**
   * Length of one budget period. At most 28 days, so a period fits inside one 29-day PayPal hold.
   */
  periodDays: number;
  /** When the current budget period ends. */
  periodEndsAt: Date;
  /** An amount of money in integer cents. */
  remainingThisPeriod: Money;
  /** An amount of money in integer cents. */
  perPurchaseMax: Money;
  /** An amount of money in integer cents. */
  approveAbove: Money;
  /** Categories the agent may buy. */
  categories: Category[];
  /** When the slip ends for good, or null if the owner set no end date. */
  expiresAt: Date | null;
  /** Only stores with an approved budget hold for this period. */
  stores: StoreAllowance[];
};

export const slipSchema: Schema<Slip> = s.object<Slip>({
  slipId: s.string(),
  periodDays: s.int(),
  periodEndsAt: s.dateTime(),
  remainingThisPeriod: moneySchema,
  perPurchaseMax: moneySchema,
  approveAbove: moneySchema,
  categories: s.array(s.lazy(() => categorySchema)),
  expiresAt: s.nullable(s.dateTime()),
  stores: s.array(s.lazy(() => storeAllowanceSchema)),
  _keysMap: {
    slipId: "slip_id",
    periodDays: "period_days",
    periodEndsAt: "period_ends_at",
    remainingThisPeriod: "remaining_this_period",
    perPurchaseMax: "per_purchase_max",
    approveAbove: "approve_above",
    expiresAt: "expires_at",
  },
});
