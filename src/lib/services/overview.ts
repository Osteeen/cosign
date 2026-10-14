// Read models for the owner's screens. Every query is scoped by owner ID.

import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, agents, approvals, holds, slips, spendRequests, stores } from "@/db/schema";
import { marketSummary, type MarketCheck } from "./market";
import { renewalState } from "./slips";

export async function agentSummaries(ownerId: string) {
  const list = await db.select().from(agents).where(eq(agents.ownerId, ownerId)).orderBy(desc(agents.createdAt));
  if (list.length === 0) return [];
  const live = await db
    .select()
    .from(slips)
    .where(and(eq(slips.ownerId, ownerId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
  const liveIds = live.map((s) => s.id);
  const liveHolds = liveIds.length
    ? await db.select().from(holds).where(and(eq(holds.ownerId, ownerId), inArray(holds.slipId, liveIds)))
    : [];
  return list.map((agent) => {
    const slip = live.find((s) => s.agentId === agent.id) ?? null;
    const period = slip ? liveHolds.filter((h) => h.slipId === slip.id && h.periodIndex === slip.currentPeriodIndex) : [];
    const next = slip ? liveHolds.filter((h) => h.slipId === slip.id && h.periodIndex === slip.currentPeriodIndex + 1) : [];
    const renewal = slip ? renewalState(slip) : { due: false, lastPeriod: false };
    return {
      agent,
      slip,
      spentCents: period.reduce((s, h) => s + h.capturedCents, 0),
      holdsAwaiting: period.filter((h) => h.status === "AWAITING_APPROVAL").length,
      holdsActive: period.filter((h) => h.status === "ACTIVE").length,
      nextHoldsAwaiting: next.filter((h) => h.status === "AWAITING_APPROVAL").length,
      // Renewal is due and the owner hasn't started it yet.
      renewalDue: renewal.due && !renewal.lastPeriod && next.length === 0,
    };
  });
}

export async function recentActivity(ownerId: string, agentId?: string, limit = 12) {
  return db
    .select({ id: activityEvents.id, summary: activityEvents.summary, occurredAt: activityEvents.occurredAt, amountCents: activityEvents.amountCents, type: activityEvents.type })
    .from(activityEvents)
    .where(agentId ? and(eq(activityEvents.ownerId, ownerId), eq(activityEvents.agentId, agentId)) : eq(activityEvents.ownerId, ownerId))
    .orderBy(desc(activityEvents.occurredAt))
    .limit(limit);
}

// ------------------------------------------------------- full activity log

// Groups people filter by; each maps to the event types it covers.
export const ACTIVITY_GROUPS = {
  paid: { label: "Paid", types: ["PAYMENT_CAPTURED", "SPEND_ALLOWED", "PAYMENT_REFUNDED"] },
  blocked: { label: "Blocked", types: ["SPEND_DENIED"] },
  approvals: { label: "Approvals", types: ["APPROVAL_REQUESTED", "APPROVAL_GRANTED", "APPROVAL_DENIED"] },
  holds: { label: "Budget holds", types: ["HOLD_APPROVED", "HOLD_REAUTHORIZED", "HOLD_RELEASED", "HOLD_EXPIRED"] },
  setup: {
    label: "Agents and slips",
    types: ["AGENT_CREATED", "AGENT_PAUSED", "AGENT_RESUMED", "AGENT_REVOKED", "SLIP_CREATED", "SLIP_ENDED", "SLIP_RENEWED", "SLIP_RENEWAL_STARTED", "SLIP_RENEWAL_DUE", "SLIP_EXPIRED", "APPROVAL_EMAILED"],
  },
  problems: { label: "Problems", types: ["PAYMENT_FAILED", "PAYMENT_UNCONFIRMED", "PAYMENT_REVERSED", "PAYMENT_NEEDS_REVIEW", "HOLD_FAILED", "HOLD_RELEASE_FAILED", "EMAIL_FAILED"] },
} as const;
export type ActivityGroup = keyof typeof ACTIVITY_GROUPS;

export const ACTIVITY_PAGE_SIZE = 25;

// Cursor = the event's exact database timestamp (microseconds) + its ID, so
// paging never skips or repeats events that share a millisecond.
const encodeCursor = (ts: string, id: string) => Buffer.from(`${ts}|${id}`).toString("base64url");
function decodeCursor(cursor: string | undefined): { ts: string; id: string } | null {
  if (!cursor || cursor.length > 200) return null;
  const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (!ts || !id || !/^[0-9a-f-]{36}$/.test(id) || Number.isNaN(Date.parse(ts))) return null;
  return { ts, id };
}

export async function listActivity(
  ownerId: string,
  opts: { agentId?: string; group?: ActivityGroup; before?: string; after?: string },
) {
  const before = decodeCursor(opts.before);
  const after = before ? null : decodeCursor(opts.after);
  const filters = [eq(activityEvents.ownerId, ownerId)];
  if (opts.agentId) filters.push(eq(activityEvents.agentId, opts.agentId));
  if (opts.group) filters.push(inArray(activityEvents.type, [...ACTIVITY_GROUPS[opts.group].types]));
  if (before) filters.push(sql`(${activityEvents.occurredAt}, ${activityEvents.id}) < (${before.ts}::timestamptz, ${before.id}::uuid)`);
  if (after) filters.push(sql`(${activityEvents.occurredAt}, ${activityEvents.id}) > (${after.ts}::timestamptz, ${after.id}::uuid)`);

  const rows = await db
    .select({
      id: activityEvents.id,
      summary: activityEvents.summary,
      occurredAt: activityEvents.occurredAt,
      ts: sql<string>`${activityEvents.occurredAt}::text`,
      amountCents: activityEvents.amountCents,
      type: activityEvents.type,
      agentName: agents.name,
    })
    .from(activityEvents)
    .leftJoin(agents, and(eq(agents.id, activityEvents.agentId), eq(agents.ownerId, ownerId)))
    .where(and(...filters))
    .orderBy(...(after ? [asc(activityEvents.occurredAt), asc(activityEvents.id)] : [desc(activityEvents.occurredAt), desc(activityEvents.id)]))
    .limit(ACTIVITY_PAGE_SIZE + 1);

  const more = rows.length > ACTIVITY_PAGE_SIZE;
  const page = rows.slice(0, ACTIVITY_PAGE_SIZE);
  if (after) page.reverse();
  const first = page[0];
  const last = page.at(-1);
  // Newest-first page: "Older" continues after the last row, "Newer" before the first.
  const hasOlder = after ? true : more;
  const hasNewer = after ? more : Boolean(before);
  return {
    events: page,
    olderCursor: hasOlder && last ? encodeCursor(last.ts, last.id) : null,
    newerCursor: hasNewer && first ? encodeCursor(first.ts, first.id) : null,
  };
}

// ---------------------------------------------------------- spending table

export const SPENDING_LIMIT = 2000;

export type SpendingRow = {
  id: string;
  at: string;
  agent: string;
  agentId: string;
  store: string;
  items: string;
  amountCents: number;
  outcome: "Paid" | "Waiting for you" | "Blocked" | "Declined" | "Expired" | "Not paid" | "Confirming";
  why: string;
  aiCheck: "Clear" | "Flagged" | "-";
  purpose: string;
  // Channel3 market prices, when they were checked (purchases that waited for the owner).
  market: string;
  // Only while waiting for the owner: what an approval must echo back.
  approvalId: string | null;
  cartHash: string | null;
};

// Every purchase request across the owner's agents, newest first, flattened
// for the spending grid. Owner-scoped; nothing here is editable.
export async function listSpending(ownerId: string): Promise<SpendingRow[]> {
  const rows = await db
    .select({ spend: spendRequests, agentName: agents.name, storeName: stores.name, approvalStatus: approvals.status, approvalId: approvals.id, approvalHash: approvals.cartHash })
    .from(spendRequests)
    .innerJoin(agents, and(eq(agents.id, spendRequests.agentId), eq(agents.ownerId, ownerId)))
    .innerJoin(stores, eq(stores.id, spendRequests.storeId))
    .leftJoin(approvals, eq(approvals.spendRequestId, spendRequests.id))
    .where(eq(spendRequests.ownerId, ownerId))
    .orderBy(desc(spendRequests.createdAt))
    .limit(SPENDING_LIMIT);

  return rows.map(({ spend, agentName, storeName, approvalStatus, approvalId, approvalHash }) => {
    const decision = spend.decision as { reasons?: { message: string }[]; intent_check?: { verdict?: string } | null };
    const items = (spend.items as { name: string; quantity: number }[]).map((i) => `${i.quantity} x ${i.name}`).join(", ");
    const verdict = decision.intent_check?.verdict;
    const outcome: SpendingRow["outcome"] =
      spend.status === "COMPLETED"
        ? "Paid"
        : spend.status === "PENDING_APPROVAL"
          ? "Waiting for you"
          : spend.status === "DENIED"
            ? approvalStatus === "DENIED"
              ? "Declined"
              : "Blocked"
            : spend.status === "APPROVAL_EXPIRED"
              ? "Expired"
              : spend.status === "PAYMENT_FAILED"
                ? "Not paid"
                : "Confirming";
    return {
      id: spend.id,
      at: spend.createdAt.toISOString(),
      agent: agentName,
      agentId: spend.agentId,
      store: storeName,
      items,
      amountCents: spend.totalCents,
      outcome,
      why: (decision.reasons ?? []).map((r) => r.message).join(" ") || (outcome === "Paid" ? "Within the slip" : ""),
      aiCheck: verdict === "CLEAR" ? "Clear" : verdict === "FLAGGED" ? "Flagged" : "-",
      purpose: spend.purpose,
      market: marketSummary(spend.marketCheck as MarketCheck | null) ?? "",
      approvalId: outcome === "Waiting for you" ? approvalId : null,
      cartHash: outcome === "Waiting for you" ? approvalHash : null,
    };
  });
}
