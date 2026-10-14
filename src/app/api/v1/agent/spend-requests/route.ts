import { authenticateAgent, fromError, json, problem, rateLimit, tooMany, unauthorized } from "@/lib/api";
import { ordersForPurchases } from "@/lib/services/orders";
import { createSpendRequest, listSpendRequestsForAgent, SpendBody, toApi } from "@/lib/services/spend";

// Ask to pay a store. The rules engine decides; ALLOW is paid inside this request.
export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    const limited = rateLimit(`spend:${agent.id}`, 30, 60_000);
    if (!limited.ok) return tooMany(limited.retryAfter);

    const key = request.headers.get("idempotency-key");
    if (!key) return problem(400, "idempotency_key_required", "Send an Idempotency-Key header, unique per purchase.");
    // Same rule as the MCP tool and the OpenAPI spec.
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return problem(400, "invalid_idempotency_key", "Idempotency-Key must be 16 to 64 letters, digits, - or _ (a UUID works).");

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return problem(400, "invalid_json", "The body must be JSON.");
    }
    const parsed = SpendBody.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return problem(400, "invalid_request", `${first?.path.join(".") || "body"}: ${first?.message ?? "invalid"}`);
    }

    const { row, replay } = await createSpendRequest(agent.id, key, parsed.data);
    const orders = await ordersForPurchases(row.ownerId, [row.id]);
    return json(toApi(row, orders.get(row.id)), replay ? 200 : 201);
  } catch (e) {
    return fromError(e);
  }
}

// This agent's own requests, newest first.
export async function GET(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 25, 1), 100);
    const rows = await listSpendRequestsForAgent(agent.id, limit);
    const orders = await ordersForPurchases(agent.ownerId, rows.map((r) => r.id));
    return json({ data: rows.map((r) => toApi(r, orders.get(r.id))), next_cursor: null });
  } catch (e) {
    return fromError(e);
  }
}
