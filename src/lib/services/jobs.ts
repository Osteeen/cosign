// The daily job: roll over or expire slips whose period ended, remind owners
// whose renewal is due, and expire stale approvals. Idempotent: running it
// twice in a day does nothing extra (reminders are de-duplicated per period).

import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { activityEvents, agents, approvals, holds, slips, users } from "@/db/schema";
import { renewalEmail } from "@/lib/email/renewal-email";
import { sendEmail } from "@/lib/email/send";
import { addDays, appUrl, logActivity } from "./common";
import { recoverWaitingHolds, releaseLeftoverHolds, renewalState, RENEWAL_WINDOW_DAYS, rollOverIfDue } from "./slips";
import { reauthorizeDueHolds } from "./reauth";
import { demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { cleanUpDemoAgents } from "./agents";
import { expireApprovals, reconcileHolds, resumeStuckPurchases } from "./spend";

export async function runDailyJob(now = new Date()) {
  const result = {
    rolledOver: 0,
    remindersSent: 0,
    reminderFailures: 0,
    ownersCheckedForApprovals: 0,
    holdsRenewed: 0,
    holdsRecovered: 0,
    purchasesRetried: 0,
    holdsReleased: 0,
    reconciliation: { checked: 0, corrected: 0, frozen: 0 },
    demoAgentsCleared: 0,
  };

  // 1. Periods that have ended: switch to renewed holds, or expire.
  const ended = await db
    .select({ id: slips.id })
    .from(slips)
    .where(and(eq(slips.status, "ACTIVE"), sql`(${slips.currentPeriodEndsAt} <= ${now} or (${slips.expiresAt} is not null and ${slips.expiresAt} <= ${now}))`));
  for (const s of ended) {
    await rollOverIfDue(s.id, now);
    result.rolledOver++;
  }

  // 2. Renewal reminders, once per slip per period.
  const dueSoon = await db
    .select({ slip: slips, agentName: agents.name, email: users.email })
    .from(slips)
    .innerJoin(agents, eq(agents.id, slips.agentId))
    .innerJoin(users, eq(users.id, slips.ownerId))
    .where(and(eq(slips.status, "ACTIVE"), eq(agents.status, "ACTIVE"), lte(slips.currentPeriodEndsAt, addDays(now, RENEWAL_WINDOW_DAYS))));
  for (const { slip, agentName, email } of dueSoon) {
    if (renewalState(slip, now).lastPeriod) continue;
    if (isDemoOwner(slip.ownerId)) continue; // demo account: no email
    const started = await db
      .select({ id: holds.id })
      .from(holds)
      .where(and(eq(holds.slipId, slip.id), eq(holds.periodIndex, slip.currentPeriodIndex + 1), inArray(holds.status, ["AWAITING_APPROVAL", "ACTIVE"])));
    if (started.length) continue;
    const marker = `${slip.id}:${slip.currentPeriodIndex}`;
    const [already] = await db
      .select({ id: activityEvents.id })
      .from(activityEvents)
      .where(and(eq(activityEvents.ownerId, slip.ownerId), eq(activityEvents.type, "SLIP_RENEWAL_DUE"), sql`${activityEvents.data}->>'marker' = ${marker}`));
    if (already) continue;

    const spent = await db
      .select({ cents: sql<number>`coalesce(sum(${holds.capturedCents}), 0)::int` })
      .from(holds)
      .where(and(eq(holds.slipId, slip.id), eq(holds.periodIndex, slip.currentPeriodIndex)));
    const mail = renewalEmail({
      agentName,
      budgetCents: slip.periodBudgetCents,
      periodDays: slip.periodDays,
      endsAt: slip.currentPeriodEndsAt,
      spentCents: spent[0]?.cents ?? 0,
      url: `${appUrl()}/agents/${slip.agentId}`,
    });
    const sent = await sendEmail({ to: email, ...mail, idempotencyKey: `renewal-${marker}` });
    await logActivity(db, {
      ownerId: slip.ownerId,
      agentId: slip.agentId,
      type: sent ? "SLIP_RENEWAL_DUE" : "EMAIL_FAILED",
      summary: sent ? "Emailed you that the budget period ends soon" : "Could not email the renewal reminder. Renew from the agent page.",
      data: sent ? { marker } : undefined,
    });
    if (sent) result.remindersSent++;
    else result.reminderFailures++;
  }

  // 3. Approvals past their 24 hours release their reserved amount.
  const owners = await db.selectDistinct({ ownerId: approvals.ownerId }).from(approvals).where(eq(approvals.status, "PENDING"));
  for (const o of owners) {
    await expireApprovals(o.ownerId);
    result.ownersCheckedForApprovals++;
  }

  // 4. Holds past PayPal's 3-day honor period are renewed ahead of the next
  // purchase (captures renew on demand too; this just keeps agents fast).
  result.holdsRenewed = await reauthorizeDueHolds(now);

  // 5. Holds PayPal placed whose answer never reached Cosign: record or release.
  result.holdsRecovered = await recoverWaitingHolds(now);

  // 6. Purchases whose PayPal answer was lost and nobody asked again: retry.
  result.purchasesRetried = await resumeStuckPurchases();

  // 7. Holds that should no longer be live at PayPal (an earlier release failed).
  result.holdsReleased = await releaseLeftoverHolds();

  // 8. Each live hold against PayPal's own list of captures (freezes on mismatch).
  result.reconciliation = await reconcileHolds();

  // 9. The shared demo account: clear agents visitors added more than a day ago.
  if (demoEnabled()) result.demoAgentsCleared = await cleanUpDemoAgents(now);
  return result;
}
