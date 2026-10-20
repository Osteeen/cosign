// When to ask PayPal again after it refused to renew (reauthorize) a hold.
// Kept free of database and PayPal imports so it can be unit-tested.

const TOO_SOON_BACKOFF_HOURS = 6;
const REFUSED_BACKOFF_HOURS = 24;
const HOLD_LIFETIME_DAYS = 29;

// Returns the new "renew after" time for the hold, or null to leave it as is
// (no answer from PayPal: try again on the next purchase or daily run).
export function renewAgainAt(refusal: { issue: string | null; definite: boolean }, now: Date, expiresAt: Date | null): Date | null {
  // Our clock ran ahead of PayPal's 3-day honor period: wait a while.
  if (refusal.issue === "REAUTHORIZATION_TOO_SOON") return new Date(now.getTime() + TOO_SOON_BACKOFF_HOURS * 3_600_000);
  // PayPal renews an authorization only once (sandbox, Oct 19, 2026). Never
  // ask again for this hold; captures keep going to the current ID until it
  // expires.
  if (refusal.issue === "REAUTHORIZATION_NOT_SUPPORTED") return expiresAt ?? new Date(now.getTime() + HOLD_LIFETIME_DAYS * 86_400_000);
  // Any other definite refusal: don't ask again on every purchase.
  if (refusal.definite) return new Date(now.getTime() + REFUSED_BACKOFF_HOURS * 3_600_000);
  return null;
}
