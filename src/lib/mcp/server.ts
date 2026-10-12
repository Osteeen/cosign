// The Cosign MCP server: lets an MCP assistant (e.g. Claude) pay PayPal
// merchants within the owner's permission slip. One server per request,
// bound to the agent whose key authenticated the request, so a tool can only
// ever act as that agent.
//
// The rules engine decides every purchase. Nothing an assistant sends -
// including the purpose text - can loosen a decision.

import "server-only";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatUsd } from "@/lib/money";
import { getAllowance } from "@/lib/services/allowance";
import { ServiceError } from "@/lib/services/common";
import { CATEGORIES } from "@/lib/services/slips";
import { createSpendRequest, getSpendRequestForAgent, listSpendRequestsForAgent, toApi } from "@/lib/services/spend";

type Agent = { id: string; name: string; status: string };

const text = (s: string) => ({ type: "text" as const, text: s });

function ok(summary: string, data: object) {
  return { content: [text(summary)], structuredContent: data as Record<string, unknown> };
}

function fail(e: unknown) {
  const message = e instanceof ServiceError ? e.message : "Cosign could not complete that. Nothing was charged; try again shortly.";
  if (!(e instanceof ServiceError)) console.error("[mcp]", e instanceof Error ? e.message : e);
  return { content: [text(message)], isError: true };
}

function describe(row: ReturnType<typeof toApi>): string {
  const amount = formatUsd(row.total.amount_cents);
  const reasons = (row.decision.reasons as { message: string }[]).map((r) => r.message).join(" ");
  switch (row.status) {
    case "COMPLETED":
      return `Paid ${amount}. PayPal paid the merchant from the owner's budget hold. Receipt ${row.receipt?.receipt_id}.`;
    case "PENDING_APPROVAL":
      return `Waiting for the owner's approval (${reasons}) The owner has been emailed. Check again with cosign_get_purchase using id ${row.id}; nothing is charged unless they approve.`;
    case "DENIED":
      return `Blocked - nothing was charged. ${reasons} Do not retry the same purchase; tell the user what the slip allows instead.`;
    case "PROCESSING":
      return `Payment is being confirmed with PayPal. Check again with cosign_get_purchase using id ${row.id}.`;
    case "PAYMENT_FAILED":
      return `PayPal did not take the payment, so nothing was charged.`;
    case "APPROVAL_EXPIRED":
      return `The owner did not approve in time, so nothing was charged.`;
    default:
      return `Status: ${row.status}.`;
  }
}

export function buildCosignMcpServer(agent: Agent): McpServer {
  const server = new McpServer({ name: "cosign", version: "0.1.0" });

  server.registerTool(
    "cosign_get_allowance",
    {
      title: "Check what I may spend",
      description:
        "Shows this agent's permission slip: budget left this period, the per-purchase limit, the amount above which the owner must approve, allowed categories, and the PayPal merchants it can pay (with their IDs). Call this before choosing what to buy.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const allowance = await getAllowance(agent);
        if (!allowance.slip) return ok(`${agent.name} has no active permission slip, so it cannot spend anything. Ask the owner to write one in Cosign.`, allowance);
        const s = allowance.slip;
        const stores = s.stores.map((x) => `${x.store.name} (id ${x.store.id}, ${formatUsd(x.remaining_in_hold.amount_cents)} left)`).join("; ");
        return ok(
          `${formatUsd(s.remaining_this_period.amount_cents)} left until ${s.period_ends_at.slice(0, 10)}. Up to ${formatUsd(s.per_purchase_max.amount_cents)} per purchase; the owner approves anything over ${formatUsd(s.approve_above.amount_cents)}. Categories: ${s.categories.join(", ")}. Merchants: ${stores || "none with an active budget hold"}.`,
          allowance,
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "cosign_request_purchase",
    {
      title: "Ask to pay a merchant",
      description:
        "Asks Cosign to pay a PayPal merchant for specific items. Cosign checks the owner's permission slip: the purchase is paid at once, sent to the owner for approval, or blocked with reasons. Cosign computes the total from the items. Use the same idempotency_key when retrying the same purchase so it is never charged twice.",
      inputSchema: {
        store_id: z.uuid().describe("Merchant ID from cosign_get_allowance"),
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(120).describe("What it is, e.g. 'A4 copy paper, 500 sheets'"),
              category: z.enum(CATEGORIES),
              quantity: z.int().min(1).max(1000),
              unit_price_cents: z.int().min(1).max(10_000_000).describe("Price of one item in cents, e.g. 1299 for $12.99"),
            }),
          )
          .min(1)
          .max(50),
        purpose: z.string().min(3).max(500).describe("One line on why, in the user's terms"),
        idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).optional().describe("Reuse to retry the same purchase safely; leave out for a new purchase"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        const total = args.items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0);
        const { row } = await createSpendRequest(agent.id, args.idempotency_key ?? `mcp-${randomUUID()}`, {
          store_id: args.store_id,
          items: args.items.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity, unit_amount_cents: i.unit_price_cents })),
          total: { amount_cents: total, currency: "USD" },
          purpose: args.purpose,
        });
        const out = toApi(row);
        return ok(describe(out), out);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "cosign_get_purchase",
    {
      title: "Check a purchase",
      description: "Gets the current status of one of this agent's purchases, e.g. while waiting for the owner's approval.",
      inputSchema: { purchase_id: z.uuid() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ purchase_id }) => {
      try {
        const out = toApi(await getSpendRequestForAgent(agent.id, purchase_id));
        return ok(describe(out), out);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "cosign_list_purchases",
    {
      title: "List recent purchases",
      description: "This agent's most recent purchases, newest first, with their status.",
      inputSchema: { limit: z.int().min(1).max(25).default(10) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      try {
        const rows = (await listSpendRequestsForAgent(agent.id, limit)).map(toApi);
        const lines = rows.map((r) => `${r.created_at.slice(0, 10)} ${formatUsd(r.total.amount_cents)} ${r.status}`).join("\n");
        return ok(rows.length ? lines : "No purchases yet.", { purchases: rows });
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}
