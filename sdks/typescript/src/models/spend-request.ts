import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { decisionSchema, type Decision } from "./decision.js";
import { lineItemSchema, type LineItem } from "./line-item.js";
import { moneySchema, type Money } from "./money.js";
import { receiptSchema, type Receipt } from "./receipt.js";
import { spendRequestStatusSchema, type SpendRequestStatus } from "./spend-request-status.js";

/** A request to pay, and what Cosign decided. */
export type SpendRequest = {
  /** The spend request's ID. */
  id: string;
  /** The agent that asked. */
  agentId: string;
  /** The store to be paid. */
  storeId: string;
  /** The cart as sent. */
  items: LineItem[];
  /** An amount of money in integer cents. */
  total: Money;
  /** The agent's reason, as sent. */
  purpose: string;
  /**
   * - `PROCESSING` - allowed; the PayPal capture is not confirmed yet. Poll.
   * - `COMPLETED` - paid.
   * - `PENDING_APPROVAL` - waiting for the owner.
   * - `DENIED` - blocked by the rules, or declined by the owner.
   * - `APPROVAL_EXPIRED` - the owner did not decide in time. Nothing was charged.
   * - `PAYMENT_FAILED` - PayPal refused the capture. Nothing was charged.
   */
  status: SpendRequestStatus;
  /** The outcome and every reason behind it. */
  decision: Decision;
  /** SHA-256 of the canonical cart. The owner's approval is bound to it. */
  cartHash: string;
  /** When an owner approval would expire; null unless waiting for the owner. */
  approvalExpiresAt: Date | null;
  /** Filled in when the request is COMPLETED. */
  receipt: Receipt | null;
  /** When the agent asked. */
  createdAt: Date;
};

export const spendRequestSchema: Schema<SpendRequest> = s.object<SpendRequest>({
  id: s.string(),
  agentId: s.string(),
  storeId: s.string(),
  items: s.array(s.lazy(() => lineItemSchema)),
  total: moneySchema,
  purpose: s.string(),
  status: spendRequestStatusSchema,
  decision: decisionSchema,
  cartHash: s.string(),
  approvalExpiresAt: s.nullable(s.dateTime()),
  receipt: s.nullable(s.lazy(() => receiptSchema)),
  createdAt: s.dateTime(),
  _keysMap: {
    agentId: "agent_id",
    storeId: "store_id",
    cartHash: "cart_hash",
    approvalExpiresAt: "approval_expires_at",
    createdAt: "created_at",
  },
});
