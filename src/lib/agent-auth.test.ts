import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET ??= "test-only-secret-not-used-anywhere-else";
const { issueToken, newAgentKey, parseBasic, secretMatches, verifyToken, TOKEN_TTL_SECONDS } = await import("./agent-auth.ts");

test("keys: secret verifies against its hash only", () => {
  const k = newAgentKey();
  assert.match(k.keyId, /^key_[0-9a-f]{24}$/);
  assert.ok(secretMatches(k.secret, k.secretHash));
  assert.equal(secretMatches(k.secret + "x", k.secretHash), false);
  assert.equal(secretMatches(newAgentKey().secret, k.secretHash), false);
});

test("basic header parsing rejects malformed input", () => {
  const k = newAgentKey();
  const ok = parseBasic(`Basic ${Buffer.from(`${k.keyId}:${k.secret}`).toString("base64")}`);
  assert.deepEqual(ok, { keyId: k.keyId, secret: k.secret });
  assert.equal(parseBasic(null), null);
  assert.equal(parseBasic("Bearer x"), null);
  assert.equal(parseBasic(`Basic ${Buffer.from("nocolon").toString("base64")}`), null);
  assert.equal(parseBasic(`Basic ${Buffer.from("key_bad:secretsecretsecretsecret").toString("base64")}`), null);
});

test("tokens verify, expire, and reject tampering", () => {
  const now = Date.now();
  const t = issueToken("agent-1", "key_" + "a".repeat(24), now);
  assert.deepEqual(verifyToken(`Bearer ${t}`, now), { agentId: "agent-1", keyId: "key_" + "a".repeat(24) });
  assert.equal(verifyToken(`Bearer ${t}`, now + TOKEN_TTL_SECONDS * 1000 + 1), null);

  const [payload, sig] = t.slice(4).split(".");
  const forged = Buffer.from(JSON.stringify({ a: "agent-2", k: "key_x", exp: 9e9 })).toString("base64url");
  assert.equal(verifyToken(`Bearer cst_${forged}.${sig}`, now), null);
  assert.equal(verifyToken(`Bearer cst_${payload}.${sig}x`, now), null);
  assert.equal(verifyToken(`Bearer ${t.slice(0, -2)}`, now), null);
  assert.equal(verifyToken(null, now), null);
});
