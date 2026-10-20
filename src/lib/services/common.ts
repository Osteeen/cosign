import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "@/db/client";
import { activityEvents } from "@/db/schema";

// A transaction handle or the pool: services accept either.
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

// Errors a person or agent can act on. `status` maps to HTTP; `code` is stable.
export class ServiceError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 502,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// "We could not find that permission slip." - plain words; "Spend request" reads as "purchase".
export const notFound = (what: string) =>
  new ServiceError(404, "not_found", `We could not find that ${what === "Spend request" ? "purchase" : what.toLowerCase()}.`);

export async function logActivity(
  tx: Tx,
  event: {
    ownerId: string;
    type: string;
    summary: string;
    agentId?: string | null;
    spendRequestId?: string | null;
    amountCents?: number | null;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(activityEvents).values({
    ownerId: event.ownerId,
    type: event.type,
    summary: event.summary,
    agentId: event.agentId ?? null,
    spendRequestId: event.spendRequestId ?? null,
    amountCents: event.amountCents ?? null,
    currency: event.amountCents == null ? null : "USD",
    data: event.data ?? null,
  });
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}
