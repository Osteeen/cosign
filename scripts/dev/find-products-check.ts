// Calls the product search as the local demo agent (read-only; Channel3 search).
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/find-products-check.ts "<query>"
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { findProducts } from "@/lib/services/products";

const [agent] = await db.select().from(agents).where(and(eq(agents.ownerId, "demo-owner"), eq(agents.name, "Office procurement bot")));
for (const q of process.argv.slice(2)) {
  const r = await findProducts(agent!, q, 5);
  console.log(`\n=== "${r.query}"`);
  for (const p of r.at_your_stores) console.log(`  HERE ${p.store.name}: ${p.name} $${(p.unit_price.amount_cents / 100).toFixed(2)} -> ${p.if_you_buy_one.outcome} ${p.if_you_buy_one.reasons.map((x) => x.code).join(",")}`);
  console.log(`  verdict: ${r.elsewhere.comparison ? `${r.elsewhere.comparison.verdict} - ${r.elsewhere.comparison.note}` : "-"}`);
  console.log(`  elsewhere "${r.elsewhere.query}" checked=${r.elsewhere.checked}: ${r.elsewhere.offers.slice(0, 4).map((o) => `$${(o.price.amount_cents / 100).toFixed(2)} ${o.merchant_domain}`).join(" | ")}`);
}
await (db.$client as { end: () => Promise<void> }).end();
