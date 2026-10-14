import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { decisionOutcomeSchema, type DecisionOutcome } from "./decision-outcome.js";
import { reasonSchema, type Reason } from "./reason.js";

/**
 * What the rules alone would decide for buying one of this product now. The AI purchase check can
 * still send a real purchase to the owner.
 */
export type RulesPreview = {
  /** What the rules (and the AI check) decided. */
  outcome: DecisionOutcome;
  reasons: Reason[];
};

export const rulesPreviewSchema: Schema<RulesPreview> = s.object<RulesPreview>({
  outcome: decisionOutcomeSchema,
  reasons: s.array(s.lazy(() => reasonSchema)),
});
