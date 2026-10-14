// End-to-end check of GET /api/v1/agent/products and the MCP tool
// cosign_find_products, called in-process with real credentials for the local
// demo agent. Mints a temporary key, revokes it at the end. Prints no secrets.
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/dev/find-products-e2e.ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agentKeys, agents } from "@/db/schema";
import { issueToken, newAgentKey } from "@/lib/agent-auth";
import { GET as productsGET } from "@/app/api/v1/agent/products/route";
import { POST as mcpPOST } from "@/app/api/mcp/route";

const [agent] = await db.select().from(agents).where(and(eq(agents.ownerId, "demo-owner"), eq(agents.name, "Office procurement bot")));
const key = newAgentKey();
await db.insert(agentKeys).values({ id: key.keyId, agentId: agent!.id, ownerId: agent!.ownerId, secretHash: key.secretHash });
const token = issueToken(agent!.id, key.keyId);
const url = (q: string) => `http://localhost:3001/api/v1/agent/products?${q}`;

try {
  const none = await productsGET(new Request(url("q=sticky+notes")));
  console.log(`REST no token: ${none.status}`);
  const bad = await productsGET(new Request(url("q=x"), { headers: { Authorization: `Bearer ${token}` } }));
  console.log(`REST q too short: ${bad.status} ${(await bad.json()).code}`);
  const res = await productsGET(new Request(url("q=sticky+notes&limit=3"), { headers: { Authorization: `Bearer ${token}` } }));
  const body = await res.json();
  console.log(`REST sticky notes: ${res.status}, at stores ${body.at_your_stores.length} (${body.at_your_stores.map((p: { name: string; if_you_buy_one: { outcome: string } }) => `${p.name} ${p.if_you_buy_one.outcome}`).join("; ")}), verdict ${body.elsewhere.comparison?.verdict ?? "-"}, offers ${body.elsewhere.offers.length}`);

  const rpc = (id: number, method: string, params: object) =>
    mcpPOST(
      new Request("http://localhost:3001/api/mcp", {
        method: "POST",
        headers: { Authorization: `Bearer ${key.keyId}:${key.secret}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      }),
    );
  const list = await (await rpc(1, "tools/list", {})).json();
  console.log(`MCP tools: ${list.result?.tools?.map((t: { name: string }) => t.name).join(", ") ?? JSON.stringify(list.error)}`);
  const call = await (await rpc(2, "tools/call", { name: "cosign_find_products", arguments: { query: "copy paper", max_results: 3 } })).json();
  console.log(`MCP cosign_find_products (isError=${call.result?.isError ?? false}):\n${call.result?.content?.[0]?.text ?? JSON.stringify(call.error)}`);
} finally {
  await db.update(agentKeys).set({ revokedAt: new Date() }).where(eq(agentKeys.id, key.keyId));
  await (db.$client as { end: () => Promise<void> }).end();
}
