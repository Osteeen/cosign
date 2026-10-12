import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { reasonCodeSchema, type ReasonCode } from "./reason-code.js";

/** One reason behind a decision. */
export type Reason = {
  /** Why a purchase was asked about or blocked. */
  code: ReasonCode;
  /** Plain words, safe to show a person. */
  message: string;
};

export const reasonSchema: Schema<Reason> = s.object<Reason>({
  code: reasonCodeSchema,
  message: s.string(),
});
