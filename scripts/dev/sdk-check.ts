// Calls the local Cosign Agent API through the APIMatic-generated TypeScript SDK
// (sdks/typescript). Read-only apart from one purchase in a category the slip
// does not allow, which Cosign blocks - nothing is charged. Never prints the key.
//   node node_modules/tsx/dist/cli.mjs scripts/dev/sdk-check.ts <key-file> [host]

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Category, CosignAgentApiClient } from "../../sdks/typescript/src/index.ts";

const [keyFile, host = "http://localhost:3001"] = process.argv.slice(2);
const [username, password] = readFileSync(keyFile!, "utf8").trim().split(":");

const keyClient = new CosignAgentApiClient({ agentKey: { username: username!, password: password! }, serverOptions: { baseUrl: `${host}/api/v1` } });
const token = await keyClient.authentication.createToken();
console.log(`token: ${token.tokenType}, expires in ${token.expiresIn}s`);

const client = new CosignAgentApiClient({ agentToken: token.accessToken, serverOptions: { baseUrl: `${host}/api/v1` } });
const me = await client.agent.getAllowance();
console.log(`allowance: ${me.status}, ${me.slip ? `$${(me.slip.remainingThisPeriod.amountCents / 100).toFixed(2)} left, stores: ${me.slip.stores.map((s) => s.store.name).join(", ")}` : "no slip"}`);

const list = await client.spendRequests.listSpendRequests({ limit: 3 });
console.log(`recent purchases: ${list.data.length}`);

const store = me.slip!.stores[0]!.store;
const blocked = await client.spendRequests.createSpendRequest({
  idempotencyKey: randomUUID(),
  body: {
    storeId: store.id,
    items: [{ name: "Train ticket", category: Category.Travel, quantity: 1, unitAmountCents: 1200 }],
    total: { amountCents: 1200 },
    purpose: "SDK check: a category this slip does not allow.",
  },
});
console.log(`purchase: ${blocked.status} - ${blocked.decision.reasons.map((r) => r.code).join(", ")}`);
const again = await client.spendRequests.getSpendRequest({ spendRequestId: blocked.id });
console.log(`read back: ${again.status}`);
