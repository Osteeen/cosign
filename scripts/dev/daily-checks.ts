// Runs the daily job's PayPal checks only (no reminder emails): reconcile live
// holds with PayPal, retry stuck purchases, retry failed releases.
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/daily-checks.ts
import { db } from "@/db/client";
import { releaseLeftoverHolds } from "@/lib/services/slips";
import { reconcileHolds, resumeStuckPurchases } from "@/lib/services/spend";
console.log("stuck purchases retried:", await resumeStuckPurchases());
console.log("leftover holds released:", await releaseLeftoverHolds());
console.log("reconciliation:", await reconcileHolds());
await (db.$client as { end: () => Promise<void> }).end();
