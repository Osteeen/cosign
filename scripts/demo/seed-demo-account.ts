// Creates the shared demo account judges sign in to (DEMO_LOGIN=on). Safe to
// run more than once: it only creates what is missing.
//   pnpm demo:seed
// Afterwards a person approves the demo slip's two budget holds in PayPal (the
// sandbox buyer), once: sign in with "Try the demo" and follow the holds page.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, slips, stores, users } from "@/db/schema";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_ID } from "@/lib/demo/account";
import { createAgent } from "@/lib/services/agents";
import { createSlip } from "@/lib/services/slips";

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
if (!live) {
  const demoStores = await db.select().from(stores).where(inArray(stores.name, ["Paper Co", "Bean Supply"]));
  if (demoStores.length !== 2) throw new Error("Seed the demo stores first (pnpm db:seed)");
  await createSlip(DEMO_OWNER_ID, bot.id, {
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
  console.log("Co-signed the demo slip; two PayPal budget holds now wait for approval.");
}
console.log(`Next: with DEMO_LOGIN=on, click "Try the demo", then approve the holds at /agents/${bot.id}/holds in the Cosign Buyer profile.`);
await (db.$client as { end: () => Promise<void> }).end();
