import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** Why a purchase was asked about or blocked. */
export const ReasonCode = {
  AgentPaused: "AGENT_PAUSED",
  AgentRevoked: "AGENT_REVOKED",
  NoActiveSlip: "NO_ACTIVE_SLIP",
  SlipExpired: "SLIP_EXPIRED",
  CurrencyMismatch: "CURRENCY_MISMATCH",
  TotalMismatch: "TOTAL_MISMATCH",
  StoreNotAllowed: "STORE_NOT_ALLOWED",
  NoActiveHold: "NO_ACTIVE_HOLD",
  HoldInsufficient: "HOLD_INSUFFICIENT",
  CategoryNotAllowed: "CATEGORY_NOT_ALLOWED",
  OverPerPurchaseMax: "OVER_PER_PURCHASE_MAX",
  OverPeriodBudget: "OVER_PERIOD_BUDGET",
  AboveApprovalThreshold: "ABOVE_APPROVAL_THRESHOLD",
  IntentFlagged: "INTENT_FLAGGED",
} as const;
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode] | (string & {});

export const reasonCodeSchema: EnumSchema<ReasonCode> = s.enumOf<ReasonCode>(ReasonCode);
