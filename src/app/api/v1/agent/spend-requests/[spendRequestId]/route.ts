import { z } from "zod";
import { authenticateAgent, fromError, json, problem, unauthorized } from "@/lib/api";
import { getSpendRequestForAgent, toApi } from "@/lib/services/spend";

// One of this agent's requests (poll it while waiting for the owner's approval).
export async function GET(request: Request, ctx: { params: Promise<{ spendRequestId: string }> }) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    const { spendRequestId } = await ctx.params;
    if (!z.uuid().safeParse(spendRequestId).success) return problem(404, "not_found", "Spend request not found.");
    return json(toApi(await getSpendRequestForAgent(agent.id, spendRequestId)));
  } catch (e) {
    return fromError(e);
  }
}
