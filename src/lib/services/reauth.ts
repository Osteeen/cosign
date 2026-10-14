// Keeps budget holds chargeable for their whole period. PayPal honors a
// capture reliably only in the 3 days after an authorization; after that we
// reauthorize, which gives the hold a new authorization ID (same amount, same
// 29-day expiry). New captures go to the current ID; voids keep using the
// original (PayPal refuses to void a reauthorized ID).

import "server-only";
import { and, eq, gt, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { holds, slips, stores } from "@/db/schema";
import { reauthorizeHold } from "@/lib/paypal/holds";
import { PayPalError } from "@/lib/paypal/client";
import { addDays, logActivity } from "./common";
import { HONOR_PERIOD_DAYS } from "./slips";

// If PayPal says it is too soon (our clock ran ahead of its), wait a while.
const TOO_SOON_BACKOFF_HOURS = 6;

// The authorization a new capture on this hold should use, reauthorizing first
// when the honor period has passed. Never throws for a PayPal problem: if the
// renewal fails, the capture is still tried on the current ID.
export async function authorizationForCapture(holdId: string, now = new Date()): Promise<string | null> {
  const [row] = await db
    .select({ hold: holds, agentId: slips.agentId, merchantId: stores.paypalMerchantId })
    .from(holds)
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .innerJoin(stores, eq(stores.id, holds.storeId))
    .where(eq(holds.id, holdId));
  if (!row?.hold.paypalAuthorizationId) return null;
  const { hold } = row;
  const current = hold.paypalCurrentAuthorizationId ?? hold.paypalAuthorizationId!;

  const stale = hold.status === "ACTIVE" && hold.honorPeriodEndsAt !== null && hold.honorPeriodEndsAt <= now && (hold.expiresAt === null || hold.expiresAt > now);
  // Renew only what is left of the hold; a fully spent hold has nothing to renew.
  const left = hold.amountCents - hold.capturedCents;
  if (!stale || left <= 0) return current;

  try {
    const renewed = await reauthorizeHold({ authorizationId: current, storeMerchantId: row.merchantId, amountCents: left });
    // Only the first of several parallel renewals writes; the rest read its result.
    const [updated] = await db
      .update(holds)
      .set({ paypalCurrentAuthorizationId: renewed.authorizationId, honorPeriodEndsAt: addDays(now, HONOR_PERIOD_DAYS) })
      .where(and(eq(holds.id, hold.id), hold.paypalCurrentAuthorizationId ? eq(holds.paypalCurrentAuthorizationId, hold.paypalCurrentAuthorizationId) : isNull(holds.paypalCurrentAuthorizationId)))
      .returning();
    if (updated) {
      await logActivity(db, {
        ownerId: hold.ownerId,
        agentId: row.agentId,
        type: "HOLD_REAUTHORIZED",
        summary: "Renewed a budget hold at PayPal so purchases keep going through",
      });
    }
    const [fresh] = await db.select({ id: holds.paypalCurrentAuthorizationId }).from(holds).where(eq(holds.id, hold.id));
    return fresh?.id ?? current;
  } catch (e) {
    if (e instanceof PayPalError && e.issue === "REAUTHORIZATION_TOO_SOON") {
      await db
        .update(holds)
        .set({ honorPeriodEndsAt: new Date(now.getTime() + TOO_SOON_BACKOFF_HOURS * 3_600_000) })
        .where(eq(holds.id, hold.id));
    } else {
      console.error(`[reauth] could not renew hold ${hold.id} (${e instanceof PayPalError ? `${e.status} ${e.issue ?? ""}` : e instanceof Error ? e.name : "error"})`);
      // A definite refusal (e.g. PayPal allows only so many renewals): don't
      // ask again on every purchase; captures go to the current ID meanwhile.
      if (e instanceof PayPalError && e.definite) {
        await db.update(holds).set({ honorPeriodEndsAt: new Date(now.getTime() + 24 * 3_600_000) }).where(eq(holds.id, hold.id));
      }
    }
    return current;
  }
}

// Daily: renew every live hold past its honor period, so agents rarely wait.
export async function reauthorizeDueHolds(now = new Date()): Promise<number> {
  // Only holds a live slip can still spend from: this period's or an approved
  // renewal. A closed slip's hold is released instead, never renewed.
  const due = await db
    .select({ id: holds.id })
    .from(holds)
    .innerJoin(slips, eq(slips.id, holds.slipId))
    .where(
      and(
        eq(holds.status, "ACTIVE"),
        isNull(holds.frozenAt),
        eq(slips.status, "ACTIVE"),
        gte(holds.periodIndex, slips.currentPeriodIndex),
        lte(holds.honorPeriodEndsAt, now),
        gt(holds.expiresAt, now),
      ),
    );
  let renewed = 0;
  for (const h of due) {
    const [before] = await db
      .select({ current: holds.paypalCurrentAuthorizationId, original: holds.paypalAuthorizationId })
      .from(holds)
      .where(eq(holds.id, h.id));
    const after = await authorizationForCapture(h.id, now);
    if (after && after !== (before?.current ?? before?.original)) renewed++;
  }
  return renewed;
}
