import { authenticateAgent, fromError, json, unauthorized } from "@/lib/api";
import { findProducts } from "@/lib/services/products";

// Product search: this agent's payable stores (with what the rules would
// decide) next to live prices elsewhere (Channel3). Read-only.
export async function GET(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 8, 1), 20);
    return json(await findProducts(agent, params.get("q") ?? "", limit));
  } catch (e) {
    return fromError(e);
  }
}
