// Agents and their keys. Every function takes the owner ID from the session
// and scopes every query by it; another owner's agent is simply "not found".

import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agentKeys, agents, approvals, holds, slips, spendRequests } from "@/db/schema";
import { newAgentKey } from "@/lib/agent-auth";
import { voidHold } from "@/lib/paypal/holds";
import { PayPalError } from "@/lib/paypal/client";
import { logActivity, notFound, ServiceError } from "./common";
import { storeMerchantIds } from "./stores";

export async function listAgents(ownerId: string) {
  return db.select().from(agents).where(eq(agents.ownerId, ownerId)).orderBy(desc(agents.createdAt));
}

export async function getAgent(ownerId: string, agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.ownerId, ownerId)));
  if (!agent) throw notFound("Agent");
  return agent;
}

export async function createAgent(ownerId: string, input: { name: string; description: string | null }) {
  const key = newAgentKey();
  return db.transaction(async (tx) => {
    const [agent] = await tx.insert(agents).values({ ownerId, name: input.name, description: input.description }).returning();
    if (!agent) throw new Error("agent insert failed");
    await tx.insert(agentKeys).values({ id: key.keyId, agentId: agent.id, ownerId, secretHash: key.secretHash });
    await logActivity(tx, { ownerId, agentId: agent.id, type: "AGENT_CREATED", summary: `Added agent "${agent.name}"` });
    // The secret leaves this function once and is never stored.
    return { agent, keyId: key.keyId, secret: key.secret };
  });
}

export async function setAgentPaused(ownerId: string, agentId: string, paused: boolean) {
  return db.transaction(async (tx) => {
    const [agent] = await tx
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.ownerId, ownerId)))
      .for("update");
    if (!agent) throw notFound("Agent");
    if (agent.status === "REVOKED") throw new ServiceError(409, "agent_revoked", "This agent is revoked and cannot be changed.");
    const status = paused ? "PAUSED" : "ACTIVE";
    if (agent.status === status) return agent;
    const [updated] = await tx.update(agents).set({ status }).where(eq(agents.id, agentId)).returning();
    await logActivity(tx, {
      ownerId,
      agentId,
      type: paused ? "AGENT_PAUSED" : "AGENT_RESUMED",
      summary: paused ? `Paused "${agent.name}"` : `Resumed "${agent.name}"`,
    });
    return updated!;
  });
}

// One click, permanent: keys dead, slips ended, pending approvals denied and
// their reservations released, then every hold released at PayPal.
export async function revokeAgent(ownerId: string, agentId: string) {
  const toRelease = await db.transaction(async (tx) => {
    const [agent] = await tx
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.ownerId, ownerId)))
      .for("update");
    if (!agent) throw notFound("Agent");
    if (agent.status === "REVOKED") return [];

    await tx.update(agents).set({ status: "REVOKED", revokedAt: new Date() }).where(eq(agents.id, agentId));
    await tx.update(agentKeys).set({ revokedAt: new Date() }).where(and(eq(agentKeys.agentId, agentId), isNull(agentKeys.revokedAt)));
    await denyPendingApprovals(tx, ownerId, agentId);

    const liveSlips = await tx
      .update(slips)
      .set({ status: "ENDED", endedAt: new Date() })
      .where(and(eq(slips.agentId, agentId), eq(slips.ownerId, ownerId), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])))
      .returning({ id: slips.id });

    const slipIds = liveSlips.map((s) => s.id);
    const liveHolds = slipIds.length
      ? await tx
          .select()
          .from(holds)
          .where(and(inArray(holds.slipId, slipIds), inArray(holds.status, ["AWAITING_APPROVAL", "ACTIVE"])))
          .for("update")
      : [];
    // Holds never approved at PayPal just close here.
    const unapproved = liveHolds.filter((h) => h.status === "AWAITING_APPROVAL").map((h) => h.id);
    if (unapproved.length) {
      await tx.update(holds).set({ status: "RELEASED", releasedAt: new Date() }).where(inArray(holds.id, unapproved));
    }

    await logActivity(tx, { ownerId, agentId, type: "AGENT_REVOKED", summary: `Revoked "${agent.name}"` });
    return liveHolds.filter((h) => h.status === "ACTIVE");
  });

  const released = await releaseHoldsAtPayPal(ownerId, toRelease, agentId);
  return { holdsReleased: released };
}

// Voids each authorization at PayPal, then marks the hold released.
export async function releaseHoldsAtPayPal(
  ownerId: string,
  activeHolds: (typeof holds.$inferSelect)[],
  agentId: string,
): Promise<number> {
  if (activeHolds.length === 0) return 0;
  const merchants = await storeMerchantIds(activeHolds.map((h) => h.storeId));
  let released = 0;
  for (const hold of activeHolds) {
    const merchantId = merchants.get(hold.storeId);
    if (!hold.paypalAuthorizationId || !merchantId) continue;
    try {
      await voidHold({ authorizationId: hold.paypalAuthorizationId, storeMerchantId: merchantId });
    } catch (e) {
      // Already voided or fully captured: nothing left to release.
      if (!(e instanceof PayPalError && e.status === 422)) {
        await logActivity(db, {
          ownerId,
          agentId,
          type: "HOLD_RELEASE_FAILED",
          summary: "PayPal did not release a hold; it will expire on its own",
          data: { holdId: hold.id, issue: e instanceof PayPalError ? e.issue : "error" },
        });
        continue;
      }
    }
    await db
      .update(holds)
      .set({ status: "RELEASED", releasedAt: new Date() })
      .where(and(eq(holds.id, hold.id), eq(holds.ownerId, ownerId)));
    await logActivity(db, { ownerId, agentId, type: "HOLD_RELEASED", summary: "Released the rest of a budget hold", data: { holdId: hold.id } });
    released++;
  }
  return released;
}

// Denies every pending approval for an agent and releases what they reserved.
export async function denyPendingApprovals(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ownerId: string, agentId: string) {
  const pending = await tx
    .select({ approvalId: approvals.id, spendId: spendRequests.id, holdId: spendRequests.holdId, total: spendRequests.totalCents })
    .from(approvals)
    .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
    .where(and(eq(approvals.ownerId, ownerId), eq(spendRequests.agentId, agentId), eq(approvals.status, "PENDING")))
    .for("update");
  for (const p of pending) {
    await tx.update(approvals).set({ status: "DENIED", decidedAt: new Date() }).where(eq(approvals.id, p.approvalId));
    await tx.update(spendRequests).set({ status: "DENIED" }).where(eq(spendRequests.id, p.spendId));
    if (p.holdId) {
      await tx
        .update(holds)
        .set({ reservedCents: sql`${holds.reservedCents} - ${p.total}` })
        .where(eq(holds.id, p.holdId));
    }
  }
}
