// Creates the shared demo account judges sign in to (DEMO_LOGIN=on). Safe to
// run more than once: it only creates what is missing, and opens again any
// budget hold that never reached PayPal.
//   pnpm demo:seed
//   DATABASE_URL=<external url> APP_URL=<https app url> pnpm demo:seed:deploy
// Both read the PayPal sandbox keys from .env.local; values given on the
// command line win over the file.
// Afterwards a person approves the demo slip's two budget holds in PayPal (the
// sandbox buyer), once: sign in with "Try the demo" and follow the holds page.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, holds, slips, stores, users } from "@/db/schema";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_ID } from "@/lib/demo/account";
import { createAgent } from "@/lib/services/agents";
import { appUrl } from "@/lib/services/common";
import { createSlip, reopenFailedHolds } from "@/lib/services/slips";

// Opening the holds calls PayPal, and PayPal sends the buyer back to APP_URL:
// refuse to start without both, rather than leave holds that failed.
// (Locally APP_URL may be unset: the app falls back to localhost.)
const deploy = process.argv.includes("--deploy");
const missing = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing ${missing.join(", ")} - see the note at the top of this script`);
if (deploy && !process.env.APP_URL?.startsWith("https://")) {
  throw new Error("For the deployed app, set APP_URL to its https address on the command line");
}

const BOT = "Office procurement bot";
const SECOND = "Travel booker";
const WORDS = "Keep us stocked with paper and coffee. $500 every 4 weeks, up to $60 per purchase, and ask me before anything over $50.";

await db.insert(users).values({ id: DEMO_OWNER_ID, email: DEMO_OWNER_EMAIL, name: "Demo owner" }).onConflictDoNothing();

const mine = await db.select().from(agents).where(eq(agents.ownerId, DEMO_OWNER_ID));
let bot = mine.find((a) => a.name === BOT && a.status !== "REVOKED");
if (!bot) {
  const created = await createAgent(DEMO_OWNER_ID, { name: BOT, description: "Restocks office supplies and coffee from the demo stores." });
  bot = created.agent;
  console.log(`Added agent "${BOT}"`);
}
if (!mine.some((a) => a.name === SECOND)) {
  await createAgent(DEMO_OWNER_ID, { name: SECOND, description: "Books train tickets. No permission slip yet." });
  console.log(`Added agent "${SECOND}" (no slip)`);
}

const [live] = await db.select({ id: slips.id }).from(slips).where(and(eq(slips.agentId, bot.id), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
let slipId = live?.id;
if (!slipId) {
  const demoStores = await db.select().from(stores).where(inArray(stores.name, ["Paper Co", "Bean Supply"]));
  if (demoStores.length !== 2) throw new Error("Seed the demo stores first (pnpm db:seed)");
  const slip = await createSlip(DEMO_OWNER_ID, bot.id, {
    periodDays: 28,
    periodBudgetCents: 50000,
    perPurchaseMaxCents: 6000,
    approveAboveCents: 5000,
    storeIds: demoStores.map((s) => s.id),
    categories: ["office_supplies", "groceries"],
    expiresAt: null,
    sourceText: WORDS,
    allocations: null,
  });
  slipId = slip.id;
  console.log("Co-signed the demo slip.");
} else {
  const [failed] = await db.select({ id: holds.id }).from(holds).where(and(eq(holds.slipId, slipId), eq(holds.status, "FAILED")));
  if (failed) console.log(`Opened ${await reopenFailedHolds(DEMO_OWNER_ID, slipId)} failed budget hold(s) at PayPal again.`);
}

// Report what PayPal really did, hold by hold.
const rows = await db.select({ status: holds.status, orderId: holds.paypalOrderId, store: stores.name }).from(holds).innerJoin(stores, eq(stores.id, holds.storeId)).where(eq(holds.slipId, slipId));
for (const h of rows) {
  const state = h.status === "AWAITING_APPROVAL" && h.orderId ? "ready to approve" : h.status === "FAILED" ? "FAILED to open at PayPal" : h.status.toLowerCase();
  console.log(`  ${h.store}: ${state}`);
}
if (rows.some((h) => h.status === "FAILED")) {
  process.exitCode = 1;
  console.log("Some holds did not open. Check the PayPal sandbox keys and run this again.");
} else if (rows.some((h) => h.status === "AWAITING_APPROVAL")) {
  console.log(`Next: click "Try the demo account", then approve the holds at ${appUrl()}/agents/${bot.id}/holds in the Cosign Buyer profile.`);
} else {
  console.log("The demo account is ready.");
}
await (db.$client as { end: () => Promise<void> }).end();
