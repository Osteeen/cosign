import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** Whether the agent may spend. Paused agents are denied; revoked agents cannot authenticate. */
export const AgentStatus = {
  Active: "ACTIVE",
  Paused: "PAUSED",
  Revoked: "REVOKED",
} as const;
export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus] | (string & {});

export const agentStatusSchema: EnumSchema<AgentStatus> = s.enumOf<AgentStatus>(AgentStatus);
