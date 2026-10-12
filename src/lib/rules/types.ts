// Types for the Cosign rules engine. Plain data in, plain decision out: no I/O,
// no clock reads, no AI. Money is always integer cents.

export type Currency = "USD";

export type Category =
  | "office_supplies"
  | "groceries"
  | "food_and_drink"
  | "travel"
  | "software"
  | "electronics"
  | "household"
  | "other";

export type ReasonCode =
  | "AGENT_PAUSED"
  | "AGENT_REVOKED"
  | "NO_ACTIVE_SLIP"
  | "SLIP_EXPIRED"
  | "STORE_NOT_ALLOWED"
  | "NO_ACTIVE_HOLD"
  | "HOLD_INSUFFICIENT"
  | "CATEGORY_NOT_ALLOWED"
  | "OVER_PER_PURCHASE_MAX"
  | "OVER_PERIOD_BUDGET"
  | "CURRENCY_MISMATCH"
  | "TOTAL_MISMATCH"
  | "ABOVE_APPROVAL_THRESHOLD"
  | "INTENT_FLAGGED";

export type Outcome = "ALLOW" | "NEEDS_APPROVAL" | "DENY";

export interface Reason {
  code: ReasonCode;
  message: string;
}

export interface SlipRules {
  currency: Currency;
  periodDays: number;
  periodBudgetCents: number;
  perPurchaseMaxCents: number;
  approveAboveCents: number;
  storeIds: readonly string[];
  categories: readonly Category[];
  expiresAt: Date | null;
}

export interface SlipState {
  status: "AWAITING_HOLDS" | "ACTIVE" | "ENDED" | "EXPIRED";
  ruleVersion: number;
  rules: SlipRules;
  currentPeriodEndsAt: Date;
  // Captured plus reserved (in-flight or awaiting approval) this period, across all stores.
  committedThisPeriodCents: number;
}

export interface HoldState {
  status: "AWAITING_APPROVAL" | "ACTIVE" | "RELEASED" | "EXPIRED" | "FAILED";
  // Hold amount minus captured and reserved amounts.
  remainingCents: number;
}

export interface LineItem {
  name: string;
  category: Category;
  quantity: number;
  unitAmountCents: number;
}

export interface SpendRequestInput {
  storeId: string;
  items: readonly LineItem[];
  total: { amountCents: number; currency: Currency };
}

export interface EvaluationInput {
  agentStatus: "ACTIVE" | "PAUSED" | "REVOKED";
  slip: SlipState | null;
  // The hold for request.storeId on the active slip, if any.
  hold: HoldState | null;
  request: SpendRequestInput;
  now: Date;
}

export interface Decision {
  outcome: Outcome;
  reasons: Reason[];
  ruleVersion: number | null;
  computedTotalCents: number;
}

export interface IntentResult {
  verdict: "CLEAR" | "FLAGGED" | "SKIPPED";
  summary: string | null;
}

export interface FinalDecision extends Decision {
  intentCheck: { verdict: IntentResult["verdict"]; escalated: boolean; summary: string | null };
}
