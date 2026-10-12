// DEV ONLY: talks to the Cosign MCP endpoint with the official MCP client, the
// way Claude would. Never prints the key.
//   node scripts/dev/mcp-check.mjs <key-file> [buy <store-id> <unit-cents> "<item>"]

import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const [keyFile, cmd, storeId, unitCents, item] = process.argv.slice(2);
const key = readFileSync(keyFile, "utf8").trim();
const url = new URL(process.env.COSIGN_MCP_URL ?? "http://localhost:3001/api/mcp");

const client = new Client({ name: "cosign-dev-check", version: "0.0.1" });
await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => `${t.name}${t.annotations?.readOnlyHint ? " (read-only)" : ""}`).join(", "));

const say = (label, r) => console.log(`\n${label}${r.isError ? " [error]" : ""}:\n  ${r.content.map((c) => c.text).join(" ")}`);

say("cosign_get_allowance", await client.callTool({ name: "cosign_get_allowance", arguments: {} }));

if (cmd === "buy") {
  const r = await client.callTool({
    name: "cosign_request_purchase",
    arguments: {
      store_id: storeId,
      items: [{ name: item, category: "groceries", quantity: 1, unit_price_cents: Number(unitCents) }],
      purpose: "User asked Claude to restock coffee",
    },
  });
  say("cosign_request_purchase", r);
  const id = r.structuredContent?.id;
  if (id) say("cosign_get_purchase", await client.callTool({ name: "cosign_get_purchase", arguments: { purchase_id: id } }));
}

say("cosign_list_purchases", await client.callTool({ name: "cosign_list_purchases", arguments: { limit: 3 } }));
await client.close();
