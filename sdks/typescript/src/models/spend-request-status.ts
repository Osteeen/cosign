import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/**
 * - `PROCESSING` - allowed; the PayPal capture is not confirmed yet. Poll. PayPal's own
 *   notification (webhook) settles it if the first answer was lost.
 * - `COMPLETED` - paid. In rare cases PayPal accepts a capture as pending and denies it later; the
 *   request then becomes `PAYMENT_FAILED`.
 * - `PENDING_APPROVAL` - waiting for the owner.
 * - `DENIED` - blocked by the rules, or declined by the owner.
 * - `APPROVAL_EXPIRED` - the owner did not decide in time. Nothing was charged.
 * - `PAYMENT_FAILED` - PayPal refused the capture. Nothing was charged.
 */
export const SpendRequestStatus = {
  Processing: "PROCESSING",
  Completed: "COMPLETED",
  PendingApproval: "PENDING_APPROVAL",
  Denied: "DENIED",
  ApprovalExpired: "APPROVAL_EXPIRED",
  PaymentFailed: "PAYMENT_FAILED",
} as const;
export type SpendRequestStatus = (typeof SpendRequestStatus)[keyof typeof SpendRequestStatus] | (string & {});

export const spendRequestStatusSchema: EnumSchema<SpendRequestStatus> =
  s.enumOf<SpendRequestStatus>(SpendRequestStatus);
