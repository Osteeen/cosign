// Owner notifications. Best effort: a failed email is logged, never allowed to
// change or block a money decision.

import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, approvals, spendRequests, stores, users } from "@/db/schema";
import { approvalEmail } from "@/lib/email/approval-email";
import { sendEmail } from "@/lib/email/send";
import { formatUsd } from "@/lib/money";
import { appUrl, logActivity } from "./common";
import { marketSummary, runMarketCheck } from "./market";
import { isDemoOwner } from "@/lib/demo/account";

export async function notifyApprovalNeeded(spendRequestId: string): Promise<void> {
  try {
    const [row] = await db
      .select({ approval: approvals, spend: spendRequests, agentName: agents.name, storeName: stores.name, email: users.email })
      .from(approvals)
      .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
      .innerJoin(agents, eq(agents.id, spendRequests.agentId))
      .innerJoin(stores, eq(stores.id, spendRequests.storeId))
      .innerJoin(users, eq(users.id, approvals.ownerId))
      .where(and(eq(approvals.spendRequestId, spendRequestId), eq(approvals.status, "PENDING"), eq(agents.ownerId, approvals.ownerId)));
    if (!row) return;

    // Market prices first (bounded by Channel3's and Claude's own timeouts), so the email can show them.
    const market = marketSummary(await runMarketCheck(spendRequestId));
    // The shared demo account has a fake address: show everything in the app, send no email.
    if (isDemoOwner(row.approval.ownerId)) return;
    const { subject, html, text } = approvalEmail({
      market,
      agentName: row.agentName,
      storeName: row.storeName,
      totalCents: row.approval.totalCents,
      items: row.spend.items as { name: string; quantity: number }[],
      purpose: row.spend.purpose,
      reasons: (row.spend.decision as { reasons?: { code: string; message: string }[] } | null)?.reasons ?? [],
      expiresAt: row.approval.expiresAt,
      url: `${appUrl()}/approvals/${row.approval.id}`,
    });
    const sent = await sendEmail({ to: row.email, subject, html, text, idempotencyKey: `approval-${row.approval.id}` });
    await logActivity(db, {
      ownerId: row.approval.ownerId,
      agentId: row.spend.agentId,
      spendRequestId,
      type: sent ? "APPROVAL_EMAILED" : "EMAIL_FAILED",
      summary: sent ? `Emailed you about ${formatUsd(row.approval.totalCents)}` : `Could not email you about ${formatUsd(row.approval.totalCents)}. It is waiting on your dashboard.`,
    });
  } catch (e) {
    console.error("[notify] approval email", e instanceof Error ? e.message : e);
  }
}
