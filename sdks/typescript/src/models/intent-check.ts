import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { intentVerdictSchema, type IntentVerdict } from "./intent-verdict.js";

/**
 * The AI purchase check. It runs only when the rules allow the purchase, and can only escalate it
 * to the owner.
 */
export type IntentCheck = {
  /** SKIPPED when the rules had already decided, or the check is not configured. */
  verdict: IntentVerdict;
  /** True when the check turned ALLOW into NEEDS_APPROVAL. */
  escalated: boolean;
  /** Why the check flagged the purchase, in plain words; null when it did not. */
  summary: string | null;
};

export const intentCheckSchema: Schema<IntentCheck> = s.object<IntentCheck>({
  verdict: intentVerdictSchema,
  escalated: s.boolean(),
  summary: s.nullable(s.string()),
});
