import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A store this agent can pay. */
export type StoreSummary = {
  /** Use as `store_id` when asking to pay. */
  id: string;
  name: string;
};

export const storeSummarySchema: Schema<StoreSummary> = s.object<StoreSummary>({
  id: s.string(),
  name: s.string(),
});
