import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** An error (RFC 9457 problem details). */
export type ProblemError = {
  /** A URI that identifies the kind of problem. */
  type: string;
  /** A short, human-readable summary of the kind of problem. */
  title: string;
  /** The HTTP status code. */
  status: number;
  /** Stable machine-readable error code. */
  code: string;
  /** A plain explanation. */
  detail: string;
};

export const problemErrorSchema: Schema<ProblemError> = s.object<ProblemError>({
  type: s.string(),
  title: s.string(),
  status: s.int(),
  code: s.string(),
  detail: s.string(),
});
