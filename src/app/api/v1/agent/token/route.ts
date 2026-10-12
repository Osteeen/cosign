import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { agentKeys, agents } from "@/db/schema";
import { issueToken, parseBasic, secretMatches, TOKEN_TTL_SECONDS } from "@/lib/agent-auth";
import { fromError, json, problem, rateLimit, tooMany } from "@/lib/api";

// Exchange an agent API key (HTTP Basic key_id:secret) for a 15-minute token.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const creds = parseBasic(request.headers.get("authorization"));
    const limited = rateLimit(`token:${ip}:${creds?.keyId ?? "none"}`, 10, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);
    if (!creds) return problem(401, "unauthorized", "Send the agent key as HTTP Basic key_id:secret.", { "WWW-Authenticate": "Basic" });

    const [row] = await db
      .select({ key: agentKeys, status: agents.status })
      .from(agentKeys)
      .innerJoin(agents, eq(agents.id, agentKeys.agentId))
      .where(and(eq(agentKeys.id, creds.keyId), isNull(agentKeys.revokedAt)));
    // Same answer for unknown key, wrong secret, paused or revoked agent.
    if (!row || !secretMatches(creds.secret, row.key.secretHash) || row.status !== "ACTIVE") {
      return problem(401, "unauthorized", "This key is not valid, or the agent is paused or revoked.", { "WWW-Authenticate": "Basic" });
    }
    await db.update(agentKeys).set({ lastUsedAt: new Date() }).where(eq(agentKeys.id, row.key.id));
    return json({ access_token: issueToken(row.key.agentId, row.key.id), token_type: "Bearer", expires_in: TOKEN_TTL_SECONDS });
  } catch (e) {
    return fromError(e);
  }
}
