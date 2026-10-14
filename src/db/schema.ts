// Cosign database schema (Drizzle, PostgreSQL).
//
// Rules this schema enforces:
// - Every owner-data table carries owner_id; every query is scoped by it.
// - Links between owner-data rows are composite foreign keys on (id, owner_id),
//   so a row can never point at another owner's agent, slip, hold or request.
// - Money is bigint cents (mode "number"; the app caps values far below 2^53).
// - Invariants that protect money are CHECK constraints or unique indexes in the
//   database, not just app code.

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const cents = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ------------------------------------------------------------------ Auth.js
// Shape required by @auth/drizzle-adapter. "users" are Cosign owners.

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: ts("email_verified"),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: ts("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: ts("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ------------------------------------------------------------------- enums

export const agentStatus = pgEnum("agent_status", ["ACTIVE", "PAUSED", "REVOKED"]);
export const slipStatus = pgEnum("slip_status", ["AWAITING_HOLDS", "ACTIVE", "ENDED", "EXPIRED"]);
export const holdStatus = pgEnum("hold_status", ["AWAITING_APPROVAL", "ACTIVE", "RELEASED", "EXPIRED", "FAILED"]);
export const spendStatus = pgEnum("spend_status", [
  "PROCESSING",
  "COMPLETED",
  "PENDING_APPROVAL",
  "DENIED",
  "APPROVAL_EXPIRED",
  "PAYMENT_FAILED",
]);
export const approvalStatus = pgEnum("approval_status", ["PENDING", "APPROVED", "DENIED", "EXPIRED"]);

// ------------------------------------------------------------------ agents

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    status: agentStatus("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("agents_owner_idx").on(t.ownerId), unique("agents_id_owner").on(t.id, t.ownerId)],
);

export const agentKeys = pgTable(
  "agent_keys",
  {
    // Public half, e.g. key_3f9a... Sent with the secret as HTTP Basic.
    id: text("id").primaryKey(),
    agentId: uuid("agent_id").notNull(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    // SHA-256 of the 32-byte random secret. The secret itself is never stored.
    secretHash: text("secret_hash").notNull(),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [
    index("agent_keys_agent_idx").on(t.agentId),
    foreignKey({ name: "agent_keys_agent_owner_fk", columns: [t.agentId, t.ownerId], foreignColumns: [agents.id, agents.ownerId] }),
  ],
);

// ------------------------------------------------------------------ stores
// Platform-wide directory of stores onboarded through PayPal Partner Referrals.

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  categories: text("categories").array().notNull(),
  website: text("website"),
  paypalMerchantId: text("paypal_merchant_id").notNull().unique(),
  paypalTrackingId: text("paypal_tracking_id").notNull().unique(),
  paymentsReceivable: boolean("payments_receivable").notNull().default(false),
  createdAt: createdAt(),
});

// --------------------------------------------------------------- addresses

// Where an owner's orders ship. Agents only ever see the label, never the
// address. US only for now (the sandbox stores are US merchants). PO boxes are fine.
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    label: text("label").notNull(),
    recipient: text("recipient").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    // Two-letter state code.
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    countryCode: text("country_code").notNull().default("US"),
    createdAt: createdAt(),
    archivedAt: ts("archived_at"),
  },
  (t) => [
    index("addresses_owner_idx").on(t.ownerId),
    unique("addresses_id_owner").on(t.id, t.ownerId),
    check("addresses_country_us", sql`${t.countryCode} = 'US'`),
    check("addresses_region_code", sql`${t.region} ~ '^[A-Z]{2}$'`),
    check("addresses_postal_code", sql`${t.postalCode} ~ '^[0-9]{5}(-[0-9]{4})?$'`),
  ],
);

// ------------------------------------------------------------------- slips

export const slips = pgTable(
  "slips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    agentId: uuid("agent_id").notNull(),
    status: slipStatus("status").notNull().default("AWAITING_HOLDS"),
    ruleVersion: integer("rule_version").notNull().default(1),
    currency: text("currency").notNull().default("USD"),
    periodDays: integer("period_days").notNull(),
    periodBudgetCents: cents("period_budget_cents").notNull(),
    perPurchaseMaxCents: cents("per_purchase_max_cents").notNull(),
    approveAboveCents: cents("approve_above_cents").notNull(),
    categories: text("categories").array().notNull(),
    expiresAt: ts("expires_at"),
    sourceText: text("source_text").notNull(),
    currentPeriodIndex: integer("current_period_index").notNull().default(0),
    currentPeriodStartsAt: ts("current_period_starts_at").notNull(),
    currentPeriodEndsAt: ts("current_period_ends_at").notNull(),
    // Where this agent's purchases ship (owner's choice; the agent sees only the label).
    shipToAddressId: uuid("ship_to_address_id"),
    createdAt: createdAt(),
    endedAt: ts("ended_at"),
  },
  (t) => [
    index("slips_owner_idx").on(t.ownerId),
    unique("slips_id_owner").on(t.id, t.ownerId),
    foreignKey({ name: "slips_agent_owner_fk", columns: [t.agentId, t.ownerId], foreignColumns: [agents.id, agents.ownerId] }),
    // Only one of the owner's own addresses.
    foreignKey({ name: "slips_ship_to_owner_fk", columns: [t.shipToAddressId, t.ownerId], foreignColumns: [addresses.id, addresses.ownerId] }),
    // At most one live slip per agent.
    uniqueIndex("slips_one_live_per_agent")
      .on(t.agentId)
      .where(sql`${t.status} in ('AWAITING_HOLDS', 'ACTIVE')`),
    check("slips_currency_usd", sql`${t.currency} = 'USD'`),
    check("slips_period_days", sql`${t.periodDays} between 1 and 28`),
    check("slips_budget_positive", sql`${t.periodBudgetCents} > 0`),
    check("slips_max_positive", sql`${t.perPurchaseMaxCents} > 0`),
    check("slips_approve_nonneg", sql`${t.approveAboveCents} >= 0`),
    check("slips_period_order", sql`${t.currentPeriodEndsAt} > ${t.currentPeriodStartsAt}`),
  ],
);

// Stores a slip allows, with each store's share of the period budget.
export const slipStores = pgTable(
  "slip_stores",
  {
    slipId: uuid("slip_id").notNull().references(() => slips.id),
    storeId: uuid("store_id").notNull().references(() => stores.id),
    allocationCents: cents("allocation_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.slipId, t.storeId] }),
    check("slip_stores_allocation_positive", sql`${t.allocationCents} > 0`),
  ],
);

// ------------------------------------------------------------------- holds
// One PayPal authorization per store per budget period.

export const holds = pgTable(
  "holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    slipId: uuid("slip_id").notNull(),
    storeId: uuid("store_id").notNull().references(() => stores.id),
    periodIndex: integer("period_index").notNull(),
    status: holdStatus("status").notNull().default("AWAITING_APPROVAL"),
    amountCents: cents("amount_cents").notNull(),
    capturedCents: cents("captured_cents").notNull().default(0),
    // Held for spend requests that are mid-capture.
    reservedCents: cents("reserved_cents").notNull().default(0),
    paypalOrderId: text("paypal_order_id").unique(),
    // The ORIGINAL authorization: voids must name it (PayPal refuses to void a
    // reauthorized ID).
    paypalAuthorizationId: text("paypal_authorization_id").unique(),
    // The authorization new captures go to: the original, or the latest
    // reauthorization once the 3-day honor period has passed. Null = original.
    paypalCurrentAuthorizationId: text("paypal_current_authorization_id").unique(),
    authorizedAt: ts("authorized_at"),
    honorPeriodEndsAt: ts("honor_period_ends_at"),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
    releasedAt: ts("released_at"),
    // Set when PayPal's own record of this hold disagrees with Cosign's (the
    // daily reconciliation). Nothing can spend from a frozen hold.
    frozenAt: ts("frozen_at"),
  },
  (t) => [
    index("holds_owner_idx").on(t.ownerId),
    unique("holds_id_owner").on(t.id, t.ownerId),
    foreignKey({ name: "holds_slip_owner_fk", columns: [t.slipId, t.ownerId], foreignColumns: [slips.id, slips.ownerId] }),
    // A hold's store must be one the slip allows.
    foreignKey({ name: "holds_slip_store_fk", columns: [t.slipId, t.storeId], foreignColumns: [slipStores.slipId, slipStores.storeId] }),
    // One live hold per store per period of a slip.
    uniqueIndex("holds_one_live_per_store_period")
      .on(t.slipId, t.storeId, t.periodIndex)
      .where(sql`${t.status} in ('AWAITING_APPROVAL', 'ACTIVE')`),
    check("holds_amount_positive", sql`${t.amountCents} > 0`),
    check("holds_nonneg", sql`${t.capturedCents} >= 0 and ${t.reservedCents} >= 0`),
    // The core money invariant: never capture or reserve beyond the hold.
    check("holds_within_amount", sql`${t.capturedCents} + ${t.reservedCents} <= ${t.amountCents}`),
  ],
);

// ---------------------------------------------------------- spend requests

export const spendRequests = pgTable(
  "spend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    agentId: uuid("agent_id").notNull(),
    slipId: uuid("slip_id"),
    storeId: uuid("store_id").notNull().references(() => stores.id),
    holdId: uuid("hold_id"),
    items: jsonb("items").notNull(),
    totalCents: cents("total_cents").notNull(),
    currency: text("currency").notNull(),
    purpose: text("purpose").notNull(),
    cartHash: text("cart_hash").notNull(),
    status: spendStatus("status").notNull(),
    // { outcome, reasons, rule_version, intent_check }
    decision: jsonb("decision").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    // SHA-256 of the request body, to detect a reused key with a different body.
    requestHash: text("request_hash").notNull(),
    approvalExpiresAt: ts("approval_expires_at"),
    // The authorization this request's capture was first sent to. Every retry
    // goes to the same one with the same PayPal-Request-Id, so a reauthorization
    // in between can never turn a retry into a second charge.
    captureAuthorizationId: text("capture_authorization_id"),
    // One capture attempt at a time: whoever sets this (while it is null or
    // past) talks to PayPal; anyone else leaves the purchase alone.
    captureLeaseUntil: ts("capture_lease_until"),
    // Channel3 market price check, run when the request waits for the owner.
    // { status, items: [{ name, verdict, note, offers: [{ domain, price, title }] }], checked_at }
    marketCheck: jsonb("market_check"),
    paypalCaptureId: text("paypal_capture_id").unique(),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("spend_requests_agent_idem").on(t.agentId, t.idempotencyKey),
    unique("spend_requests_id_owner").on(t.id, t.ownerId),
    foreignKey({ name: "spend_requests_agent_owner_fk", columns: [t.agentId, t.ownerId], foreignColumns: [agents.id, agents.ownerId] }),
    foreignKey({ name: "spend_requests_slip_owner_fk", columns: [t.slipId, t.ownerId], foreignColumns: [slips.id, slips.ownerId] }),
    foreignKey({ name: "spend_requests_hold_owner_fk", columns: [t.holdId, t.ownerId], foreignColumns: [holds.id, holds.ownerId] }),
    index("spend_requests_owner_idx").on(t.ownerId, t.createdAt),
    check("spend_total_positive", sql`${t.totalCents} > 0`),
  ],
);

// --------------------------------------------------------------- approvals

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    spendRequestId: uuid("spend_request_id").notNull().unique(),
    status: approvalStatus("status").notNull().default("PENDING"),
    // Snapshot the owner approves; must still match at approve time.
    cartHash: text("cart_hash").notNull(),
    totalCents: cents("total_cents").notNull(),
    expiresAt: ts("expires_at").notNull(),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("approvals_owner_status_idx").on(t.ownerId, t.status),
    foreignKey({ name: "approvals_spend_owner_fk", columns: [t.spendRequestId, t.ownerId], foreignColumns: [spendRequests.id, spendRequests.ownerId] }),
  ],
);

// ---------------------------------------------------------------- activity
// Append-only, enforced by a trigger (drizzle/0001_activity_append_only.sql).

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    agentId: uuid("agent_id"),
    spendRequestId: uuid("spend_request_id"),
    type: text("type").notNull(),
    amountCents: cents("amount_cents"),
    currency: text("currency"),
    summary: text("summary").notNull(),
    data: jsonb("data"),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_owner_time_idx").on(t.ownerId, t.occurredAt),
    foreignKey({ name: "activity_agent_owner_fk", columns: [t.agentId, t.ownerId], foreignColumns: [agents.id, agents.ownerId] }),
    foreignKey({ name: "activity_spend_owner_fk", columns: [t.spendRequestId, t.ownerId], foreignColumns: [spendRequests.id, spendRequests.ownerId] }),
  ],
);

// ------------------------------------------------------------- idempotency
// For owner API POSTs (agent spend requests use spend_requests_agent_idem).

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    ownerId: text("owner_id").notNull().references(() => users.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    statusCode: integer("status_code"),
    response: jsonb("response"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.key] })],
);

// ------------------------------------------------------------------ orders

export const orderStatus = pgEnum("order_status", ["SENT", "SEEN", "SHIPPED", "CANCELLED"]);

// What the store must ship for a paid purchase. Created when the payment
// completes. ship_to is a copy of the address at that moment (null when the
// slip has none). Stores open it with a private link signed by Cosign.
// SEEN means the store confirmed it (a button, so link previews don't count).
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull().references(() => users.id),
    agentId: uuid("agent_id").notNull(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id),
    spendRequestId: uuid("spend_request_id").notNull().unique(),
    items: jsonb("items").notNull(),
    totalCents: cents("total_cents").notNull(),
    shipTo: jsonb("ship_to"),
    status: orderStatus("status").notNull().default("SENT"),
    // PayPal accepted the capture as PENDING: the store must not ship until
    // PayPal confirms it (PAYMENT.CAPTURE.COMPLETED clears this).
    paymentPending: boolean("payment_pending").notNull().default(false),
    createdAt: createdAt(),
    seenAt: ts("seen_at"),
    shippedAt: ts("shipped_at"),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [
    index("orders_owner_idx").on(t.ownerId, t.createdAt),
    index("orders_store_idx").on(t.storeId, t.createdAt),
    foreignKey({ name: "orders_spend_owner_fk", columns: [t.spendRequestId, t.ownerId], foreignColumns: [spendRequests.id, spendRequests.ownerId] }),
    foreignKey({ name: "orders_agent_owner_fk", columns: [t.agentId, t.ownerId], foreignColumns: [agents.id, agents.ownerId] }),
    check("orders_total_positive", sql`${t.totalCents} > 0`),
  ],
);

// ---------------------------------------------------------- PayPal webhooks

export const paypalWebhookEvents = pgTable("paypal_webhook_events", {
  // PayPal's event ID: processing is idempotent on it.
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  verified: boolean("verified").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
});
