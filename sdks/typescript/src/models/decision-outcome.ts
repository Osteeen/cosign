import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** What the rules (and the AI check) decided. */
export const DecisionOutcome = {
  Allow: "ALLOW",
  NeedsApproval: "NEEDS_APPROVAL",
  Deny: "DENY",
} as const;
export type DecisionOutcome = (typeof DecisionOutcome)[keyof typeof DecisionOutcome] | (string & {});

export const decisionOutcomeSchema: EnumSchema<DecisionOutcome> = s.enumOf<DecisionOutcome>(DecisionOutcome);
