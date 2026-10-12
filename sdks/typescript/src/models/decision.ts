import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { decisionOutcomeSchema, type DecisionOutcome } from "./decision-outcome.js";
import { intentCheckSchema, type IntentCheck } from "./intent-check.js";
import { reasonSchema, type Reason } from "./reason.js";

/** The outcome and every reason behind it. */
export type Decision = {
  /** What the rules (and the AI check) decided. */
  outcome: DecisionOutcome;
  /** Empty when the purchase was simply allowed. */
  reasons: Reason[];
  /** Version of the slip's rules used. Null when there was no slip. */
  ruleVersion: number | null;
  /**
   * The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it
   * to the owner.
   */
  intentCheck: IntentCheck;
};

export const decisionSchema: Schema<Decision> = s.object<Decision>({
  outcome: decisionOutcomeSchema,
  reasons: s.array(s.lazy(() => reasonSchema)),
  ruleVersion: s.nullable(s.int()),
  intentCheck: intentCheckSchema,
  _keysMap: {
    ruleVersion: "rule_version",
    intentCheck: "intent_check",
  },
});
