import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { agentStatusSchema, type AgentStatus } from "./agent-status.js";
import { slipSchema, type Slip } from "./slip.js";

/** What the agent may spend right now. */
export type Allowance = {
  /** This agent's ID. */
  agentId: string;
  /** Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate. */
  status: AgentStatus;
  /** The active permission slip, or null when the agent has none. */
  slip: Slip | null;
};

export const allowanceSchema: Schema<Allowance> = s.object<Allowance>({
  agentId: s.string(),
  status: agentStatusSchema,
  slip: s.nullable(s.lazy(() => slipSchema)),
  _keysMap: {
    agentId: "agent_id",
  },
});
