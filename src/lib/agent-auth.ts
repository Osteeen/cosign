// Agent credentials.
// - API key: public id "key_<hex>" + 32-byte random secret. Only a SHA-256 of
//   the secret is stored; the secret is shown to the owner once.
// - Token: the key is exchanged for a 15-minute HMAC-signed bearer token. The
//   agent's status is re-checked in the database on every request, so pausing
//   or revoking takes effect immediately, not when the token expires.

import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_TTL_SECONDS = 15 * 60;

export function newAgentKey(): { keyId: string; secret: string; secretHash: string } {
  const keyId = `key_${randomBytes(12).toString("hex")}`;
  const secret = `cs_${randomBytes(32).toString("base64url")}`;
  return { keyId, secret, secretHash: hashSecret(secret) };
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// "Authorization: Basic base64(key_id:secret)"
export function parseBasic(header: string | null): { keyId: string; secret: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }
  const i = decoded.indexOf(":");
  if (i < 1) return null;
  const keyId = decoded.slice(0, i);
  const secret = decoded.slice(i + 1);
  if (!/^key_[0-9a-f]{24}$/.test(keyId) || secret.length < 20 || secret.length > 200) return null;
  return { keyId, secret };
}

function tokenKey(): Buffer {
  const root = process.env.AUTH_SECRET;
  if (!root) throw new Error("AUTH_SECRET is not set");
  // A separate key derived for agent tokens, so it is never the session secret itself.
  return Buffer.from(hkdfSync("sha256", root, "cosign-agent-token", "v1", 32));
}

export function issueToken(agentId: string, keyId: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ a: agentId, k: keyId, exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS }),
  ).toString("base64url");
  const sig = createHmac("sha256", tokenKey()).update(payload).digest("base64url");
  return `cst_${payload}.${sig}`;
}

export function verifyToken(header: string | null, now = Date.now()): { agentId: string; keyId: string } | null {
  if (!header?.startsWith("Bearer cst_")) return null;
  const [payload, sig] = header.slice("Bearer cst_".length).split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", tokenKey()).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { a, k, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { a: string; k: string; exp: number };
    if (typeof a !== "string" || typeof k !== "string" || typeof exp !== "number") return null;
    if (exp * 1000 <= now) return null;
    return { agentId: a, keyId: k };
  } catch {
    return null;
  }
}
