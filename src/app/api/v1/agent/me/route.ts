import { authenticateAgent, fromError, json, unauthorized } from "@/lib/api";
import { getAllowance } from "@/lib/services/allowance";

// What this agent may spend right now. Only stores with an active hold are listed.
export async function GET(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    if (!agent) return unauthorized();
    return json(await getAllowance(agent));
  } catch (e) {
    return fromError(e);
  }
}
