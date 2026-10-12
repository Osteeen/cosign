// Helpers for the agent API: problem+json errors, a small rate limiter, and
// agent authentication that re-checks the agent and key in the database on
// every request (so pause and revoke take effect immediately).

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { agentKeys, agents } from "@/db/schema";
import { parseBasic, secretMatches, verifyToken } from "./agent-auth";
import { ServiceError } from "./services/common";

export function problem(status: number, code: string, detail: string, headers: Record<string, string> = {}) {
  return Response.json(
    { type: `https://cosign.example/problems/${code}`, title: code.replace(/_/g, " "), status, code, detail },
    { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store", ...headers } },
  );
}

export function fromError(e: unknown): Response {
  if (e instanceof ServiceError) return problem(e.status, e.code, e.message);
  // Never leak internals: log server-side, answer generically.
  console.error("[api] unexpected error", e instanceof Error ? e.message : e);
  return problem(500, "internal_error", "Something went wrong on our side. Nothing was charged.");
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Fixed-window limiter, per process. Enough for one app instance; a shared
// store would be needed for several.
const windows = new Map<string, { start: number; count: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    return { ok: true };
  }
  w.count++;
  if (w.count > limit) return { ok: false, retryAfter: Math.ceil((w.start + windowMs - now) / 1000) };
  return { ok: true };
}

export const tooMany = (retryAfter: number) =>
  problem(429, "rate_limited", "Too many requests. Try again shortly.", { "Retry-After": String(retryAfter) });

// Returns the agent for a valid bearer token whose agent and key are still live.
export async function authenticateAgent(request: Request) {
  const claims = verifyToken(request.headers.get("authorization"));
  if (!claims) return null;
  const [row] = await db
    .select({ agent: agents })
    .from(agents)
    .innerJoin(agentKeys, and(eq(agentKeys.agentId, agents.id), eq(agentKeys.id, claims.keyId), isNull(agentKeys.revokedAt)))
    .where(eq(agents.id, claims.agentId));
  if (!row || row.agent.status === "REVOKED") return null;
  return row.agent;
}

export const unauthorized = () => problem(401, "unauthorized", "Missing, invalid or expired agent token.", { "WWW-Authenticate": "Bearer" });

// MCP clients send the agent's API key itself: "Authorization: Bearer key_x:cs_y".
// Checked against the stored hash on every request; revoked keys and agents fail.
export async function authenticateAgentKey(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer key_")) return null;
  const creds = parseBasic(`Basic ${Buffer.from(header.slice(7)).toString("base64")}`);
  if (!creds) return null;
  const [row] = await db
    .select({ agent: agents, secretHash: agentKeys.secretHash })
    .from(agentKeys)
    .innerJoin(agents, eq(agents.id, agentKeys.agentId))
    .where(and(eq(agentKeys.id, creds.keyId), isNull(agentKeys.revokedAt)));
  if (!row || !secretMatches(creds.secret, row.secretHash) || row.agent.status === "REVOKED") return null;
  await db.update(agentKeys).set({ lastUsedAt: new Date() }).where(eq(agentKeys.id, creds.keyId));
  return { agent: row.agent, keyId: creds.keyId };
}
