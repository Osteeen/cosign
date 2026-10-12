// DEV ONLY: give an existing agent an extra API key for local testing, written
// to a private file (mode 600) and never printed. Revoke it from the UI or by
// revoking the agent when done.
//   node --env-file=.env.local scripts/dev/issue-test-key.mjs <agent-id> <output-file>

import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import pg from "pg";

const [agentId, out] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/.test(agentId ?? "") || !out) {
  console.error("usage: issue-test-key.mjs <agent-id> <output-file>");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing: DATABASE_URL is not a local database");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("select owner_id, status from agents where id = $1", [agentId]);
  if (!rows[0] || rows[0].status === "REVOKED") throw new Error("agent not found or revoked");
  const keyId = `key_${randomBytes(12).toString("hex")}`;
  const secret = `cs_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(secret).digest("hex");
  await client.query("insert into agent_keys (id, agent_id, owner_id, secret_hash) values ($1, $2, $3, $4)", [keyId, agentId, rows[0].owner_id, hash]);
  writeFileSync(out, `${keyId}:${secret}\n`, { mode: 0o600 });
  console.log(`test key ${keyId} written to the output file`);
} finally {
  await client.end();
}
