import { z } from "zod";
import { authenticateAgent, fromError, json, problem, unauthorized } from "@/lib/api";
import { ordersForPurchases } from "@/lib/services/orders";
import { getSpendRequestForAgent, toApi } from "@/lib/services/spend";

// One of this agent's requests (poll it while waiting for the owner's approval).
export async function GET(request: Request, ctx: { params: Promise<{ spendRequestId: string }> }) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    const { spendRequestId } = await ctx.params;
    if (!z.uuid().safeParse(spendRequestId).success) return problem(404, "not_found", "Spend request not found.");
    const row = await getSpendRequestForAgent(agent.id, spendRequestId);
    const orders = await ordersForPurchases(row.ownerId, [row.id]);
    return json(toApi(row, orders.get(row.id)));
  } catch (e) {
    return fromError(e);
  }
}
