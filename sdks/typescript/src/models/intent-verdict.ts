import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** SKIPPED when the rules had already decided, or the check is not configured. */
export const IntentVerdict = {
  Clear: "CLEAR",
  Flagged: "FLAGGED",
  Skipped: "SKIPPED",
} as const;
export type IntentVerdict = (typeof IntentVerdict)[keyof typeof IntentVerdict] | (string & {});

export const intentVerdictSchema: EnumSchema<IntentVerdict> = s.enumOf<IntentVerdict>(IntentVerdict);
