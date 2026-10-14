"use server";

// Owner actions. The owner always comes from the session (requireOwner); IDs in
// the form are only pointers, and every service re-checks that the owner owns them.

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { agentKeys, sessions, users } from "@/db/schema";
import { DEMO_OWNER_ID, DEMO_SESSION_HOURS, demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { parseDollars } from "@/lib/money";
import { requireOwner } from "@/lib/owner";
import { draftSlip, type SlipDraft } from "@/lib/ai/draft-slip";
import { rateLimit, clientIp } from "@/lib/api";
import { listSpending, type SpendingRow } from "@/lib/services/overview";
import { createAgent, getAgent, revokeAgent, setAgentPaused } from "@/lib/services/agents";
import { listStores } from "@/lib/services/stores";
import { appUrl, ServiceError } from "@/lib/services/common";
import { CATEGORIES, createSlip, endSlip, renewSlip, setSlipShipTo } from "@/lib/services/slips";
import { archiveAddress, createAddress, updateAddress } from "@/lib/services/addresses";
import { confirmOrder, markOrderShipped } from "@/lib/services/orders";
import { decideApproval } from "@/lib/services/spend";

const Uuid = z.uuid();
const id = (form: FormData, field: string) => {
  const v = Uuid.safeParse(form.get(field));
  if (!v.success) throw new ServiceError(400, "bad_request", "Missing or invalid ID.");
  return v.data;
};
const str = (form: FormData, field: string) => String(form.get(field) ?? "").trim();
const notice = (path: string, code: string) => `${path}${path.includes("?") ? "&" : "?"}notice=${encodeURIComponent(code)}`;

// ------------------------------------------------------------- agents

export type NewAgentState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; agentId: string; agentName: string; keyId: string; secret: string };

export async function createAgentAction(_prev: NewAgentState, form: FormData): Promise<NewAgentState> {
  const owner = await requireOwner();
  const name = str(form, "name");
  const description = str(form, "description");
  if (name.length < 1 || name.length > 80) return { status: "error", message: "Give the agent a name of up to 80 characters." };
  if (description.length > 280) return { status: "error", message: "Keep the description under 280 characters." };
  if (!rateLimit(`create-agent:${owner.id}`, 10, 60 * 60_000).ok) return { status: "error", message: "That's a lot of new agents at once. Try again in an hour." };
  let created;
  try {
    created = await createAgent(owner.id, { name, description: description || null });
  } catch (e) {
    if (e instanceof ServiceError) return { status: "error", message: e.message };
    throw e;
  }
  const { agent, keyId, secret } = created;
  revalidatePath("/");
  // Returned to this page only, shown once, never stored in plain text.
  return { status: "created", agentId: agent.id, agentName: agent.name, keyId, secret };
}

export async function pauseAgentAction(form: FormData) {
  const owner = await requireOwner();
  const agentId = id(form, "agentId");
  const paused = form.get("paused") === "true";
  await runOrNotice(() => setAgentPaused(owner.id, agentId, paused), `/agents/${agentId}`);
  revalidatePath(`/agents/${agentId}`);
  redirect(notice(`/agents/${agentId}`, paused ? "agent-paused" : "agent-resumed"));
}

export async function revokeAgentAction(form: FormData) {
  const owner = await requireOwner();
  const agentId = id(form, "agentId");
  await blockDemo(owner.id, `/agents/${agentId}`);
  await runOrNotice(() => revokeAgent(owner.id, agentId), `/agents/${agentId}`);
  revalidatePath("/");
  redirect(notice(`/agents/${agentId}`, "agent-revoked"));
}

// -------------------------------------------------------------- slips

export type SlipFormState = { status: "idle" } | { status: "error"; message: string };

export async function createSlipAction(_prev: SlipFormState, form: FormData): Promise<SlipFormState> {
  const owner = await requireOwner();
  const agentId = id(form, "agentId");
  if (isDemoOwner(owner.id)) {
    return { status: "error", message: "The demo account can't co-sign new slips: each one needs PayPal approvals from a real owner. Try \"Fill in the rules from my words\" to see the AI drafting." };
  }

  const budget = parseDollars(str(form, "budget"));
  const perPurchase = parseDollars(str(form, "perPurchase"));
  const approveAbove = parseDollars(str(form, "approveAbove") || "0");
  const periodDays = Number(str(form, "periodDays"));
  const storeIds = form.getAll("storeIds").map(String);
  const categories = form.getAll("categories").map(String);
  const endsOn = str(form, "endsOn");
  const sourceText = str(form, "sourceText");
  const shipToAddressId = str(form, "shipToAddressId") || null;

  if (budget === null || perPurchase === null || approveAbove === null) {
    return { status: "error", message: "Enter amounts in dollars, like 200 or 49.99." };
  }
  if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 28) {
    return { status: "error", message: "A budget period is 1 to 28 days." };
  }
  if (storeIds.length === 0) return { status: "error", message: "Choose at least one store." };
  if (categories.length === 0 || !categories.every((c) => (CATEGORIES as readonly string[]).includes(c))) {
    return { status: "error", message: "Choose at least one category." };
  }

  // Each store's share; all blank means an even split.
  let allocations: Record<string, number> | null = null;
  const shares = storeIds.map((s) => [s, str(form, `share-${s}`)] as const);
  if (shares.some(([, v]) => v !== "")) {
    allocations = {};
    for (const [s, v] of shares) {
      const cents = parseDollars(v);
      if (cents === null || cents < 100) return { status: "error", message: "Give every chosen store an amount of at least $1, or leave them all blank for an even split." };
      allocations[s] = cents;
    }
  }

  let expiresAt: Date | null = null;
  if (endsOn) {
    expiresAt = new Date(`${endsOn}T23:59:59Z`);
    if (Number.isNaN(expiresAt.getTime())) return { status: "error", message: "Enter a valid end date." };
  }

  try {
    await createSlip(owner.id, agentId, {
      periodDays,
      periodBudgetCents: budget,
      perPurchaseMaxCents: perPurchase,
      approveAboveCents: approveAbove,
      storeIds,
      categories: categories as (typeof CATEGORIES)[number][],
      expiresAt,
      sourceText: sourceText || "Set by the owner on the slip form",
      allocations,
      shipToAddressId,
    });
  } catch (e) {
    if (e instanceof ServiceError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: e.issues[0]?.message ?? "Check the slip and try again." };
    throw e;
  }
  revalidatePath(`/agents/${agentId}`);
  redirect(notice(`/agents/${agentId}/holds`, "slip-created"));
}

export async function endSlipAction(form: FormData) {
  const owner = await requireOwner();
  const slipId = id(form, "slipId");
  const agentId = id(form, "agentId");
  await blockDemo(owner.id, `/agents/${agentId}`);
  await runOrNotice(() => endSlip(owner.id, slipId), `/agents/${agentId}`);
  revalidatePath(`/agents/${agentId}`);
  redirect(notice(`/agents/${agentId}`, "slip-ended"));
}

export async function renewSlipAction(form: FormData) {
  const owner = await requireOwner();
  const slipId = id(form, "slipId");
  const agentId = id(form, "agentId");
  await blockDemo(owner.id, `/agents/${agentId}`);
  await runOrNotice(() => renewSlip(owner.id, slipId), `/agents/${agentId}`);
  revalidatePath(`/agents/${agentId}`);
  redirect(notice(`/agents/${agentId}/holds`, "renewal-started"));
}

// ---------------------------------------------------------- approvals

export async function decideApprovalAction(form: FormData) {
  const owner = await requireOwner();
  const approvalId = id(form, "approvalId");
  const decision = form.get("decision") === "approve" ? "approve" : "deny";
  const cartHash = str(form, "cartHash");
  const totalCents = Number(str(form, "totalCents"));
  const backRaw = str(form, "back");
  const back = /^\/(agents|approvals)\/[0-9a-f-]{36}$/.test(backRaw) ? backRaw : "/";
  const row = await runOrNotice(() => decideApproval(owner.id, approvalId, decision, { cartHash, totalCents }), back);
  revalidatePath("/");
  const outcome = decision === "deny" ? "approval-denied" : row?.status === "COMPLETED" ? "approval-paid" : "approval-payment-failed";
  redirect(notice(back, outcome));
}

// Approve or decline several waiting purchases at once. Each one goes through
// the same single-purchase path: its own cart check (the owner approves exactly
// the cart and total they saw), its own capture, its own result. One failing
// never stops or changes the others.
const BULK_MAX = 20;
const BULK_ITEM = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|([0-9a-f]{64})\|(\d{1,9})$/;

export async function decideManyAction(form: FormData) {
  const owner = await requireOwner();
  const decisionRaw = form.get("decision");
  if (decisionRaw !== "approve" && decisionRaw !== "deny") redirect("/");
  const decision = decisionRaw;
  const raw = form.getAll("item").map(String);
  if (raw.length === 0 || raw.length > BULK_MAX) redirect("/");

  const seen = new Set<string>();
  const items: { approvalId: string; cartHash: string; totalCents: number }[] = [];
  for (const r of raw) {
    const m = BULK_ITEM.exec(r);
    if (!m || seen.has(m[1]!)) continue;
    seen.add(m[1]!);
    items.push({ approvalId: m[1]!, cartHash: m[2]!, totalCents: Number(m[3]) });
  }

  let done = 0;
  let skipped = 0;
  let problems = 0;
  for (const item of items) {
    try {
      const row = await decideApproval(owner.id, item.approvalId, decision, { cartHash: item.cartHash, totalCents: item.totalCents });
      if (decision === "deny" || row.status === "COMPLETED") done++;
      else problems++; // PayPal refused it, or is still confirming
    } catch (e) {
      if (e instanceof ServiceError) skipped++; // already decided, changed, expired, agent paused...
      else throw e;
    }
  }
  revalidatePath("/");
  revalidatePath("/spending");
  const back = form.get("back") === "/spending" ? "/spending" : "/";
  redirect(`${back}?bulk=${decision === "approve" ? "a" : "d"}.${done}.${skipped}.${problems}`);
}

// The spending grid refreshes itself with this while the page is open.
export async function spendingRowsAction(): Promise<SpendingRow[]> {
  const owner = await requireOwner();
  if (!rateLimit(`spending:${owner.id}`, 30, 60_000).ok) throw new Error("rate_limited");
  return listSpending(owner.id);
}

// ------------------------------------------------------------ demo account

// One click into the shared demo account (judges). Creates an ordinary
// database session for the demo owner, short-lived, rate-limited per address.
export async function demoSignInAction() {
  if (!demoEnabled()) redirect("/sign-in");
  const h = await headers();
  const ip = clientIp(h);
  if (!rateLimit(`demo-signin:${ip}`, 10, 60 * 60_000).ok) redirect("/sign-in?error=slow");
  const [demo] = await db.select({ id: users.id }).from(users).where(eq(users.id, DEMO_OWNER_ID));
  if (!demo) redirect("/sign-in?error=demo");

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DEMO_SESSION_HOURS * 3_600_000);
  await db.insert(sessions).values({ sessionToken: token, userId: DEMO_OWNER_ID, expires });
  const secure = h.get("x-forwarded-proto") === "https" || appUrl().startsWith("https://");
  (await cookies()).set(`${secure ? "__Secure-" : ""}authjs.session-token`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
  redirect("/?notice=demo-welcome");
}

// The demo account shares one set of PayPal holds: these would break it for the next judge.
// ---------------------------------------------------------------- addresses

// Where to go back to after the address book: only our own pages.
function safeBack(value: string): string {
  return /^\/agents\/[0-9a-f-]{36}(\/slip)?$/.test(value) ? value : "/addresses";
}

export type AddressFormState = { status: "idle" } | { status: "error"; message: string };

export async function saveAddressAction(_prev: AddressFormState, form: FormData): Promise<AddressFormState> {
  const owner = await requireOwner();
  // The demo account is shared: an address typed there would be seen by others.
  if (isDemoOwner(owner.id)) return { status: "error", message: "The demo account uses a sample address and can't save new ones." };
  const addressId = str(form, "addressId");
  const input = {
    label: str(form, "label"),
    recipient: str(form, "recipient"),
    line1: str(form, "line1"),
    line2: str(form, "line2"),
    city: str(form, "city"),
    region: str(form, "region").toUpperCase(),
    postal_code: str(form, "postal_code"),
  };
  try {
    if (addressId) await updateAddress(owner.id, addressId, input);
    else await createAddress(owner.id, input);
  } catch (e) {
    if (e instanceof ServiceError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const issue = e.issues[0];
      const field = String(issue?.path[0] ?? "");
      const what: Record<string, string> = { label: "label", recipient: "recipient name", line1: "street address", line2: "second line", city: "city", region: "state", postal_code: "ZIP code" };
      return { status: "error", message: field === "region" ? "Use a two-letter US state code, like CA." : field === "postal_code" ? (issue?.message ?? "Check the ZIP code.") : `Check the ${what[field] ?? "address"}.` };
    }
    throw e;
  }
  revalidatePath("/addresses");
  redirect(notice(safeBack(str(form, "back")), addressId ? "address-saved" : "address-added"));
}

export async function archiveAddressAction(form: FormData) {
  const owner = await requireOwner();
  await blockDemo(owner.id, "/addresses", "demo-address");
  const addressId = id(form, "addressId");
  await runOrNotice(() => archiveAddress(owner.id, addressId), "/addresses");
  revalidatePath("/addresses");
  redirect(notice("/addresses", "address-removed"));
}

export async function setShipToAction(form: FormData) {
  const owner = await requireOwner();
  const slipId = id(form, "slipId");
  const agentId = id(form, "agentId");
  await blockDemo(owner.id, `/agents/${agentId}`, "demo-address");
  const addressId = str(form, "addressId") || null;
  await runOrNotice(() => setSlipShipTo(owner.id, slipId, addressId), `/agents/${agentId}`);
  revalidatePath(`/agents/${agentId}`);
  redirect(notice(`/agents/${agentId}`, "ship-to-changed"));
}

// The store's buttons on its order page: authorized by the link's signed
// token, not a sign-in. A wrong token looks like a missing order.
async function storeOrderStep(form: FormData, step: (orderId: string, token: string) => Promise<{ status: string }>, done: string) {
  const orderId = str(form, "orderId");
  const token = str(form, "t");
  let code: string;
  try {
    const order = await step(orderId, token);
    code = order.status === "CANCELLED" ? "order-cancelled" : done;
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    if (e instanceof ServiceError) code = e.code;
    else throw e;
  }
  redirect(`/orders/${orderId}?t=${encodeURIComponent(token)}&notice=${code}`);
}

export async function confirmOrderAction(form: FormData) {
  await storeOrderStep(form, confirmOrder, "order-confirmed");
}

export async function markShippedAction(form: FormData) {
  await storeOrderStep(form, markOrderShipped, "order-shipped");
}

async function blockDemo(ownerId: string, back: string, code = "demo-blocked") {
  if (isDemoOwner(ownerId)) redirect(notice(back, code));
}

// Turns a ServiceError into a notice on the page instead of an error screen.
async function runOrNotice<T>(fn: () => Promise<T>, back: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceError) redirect(notice(back, e.code));
    throw e;
  }
}

// ------------------------------------------------------- connection status

// Has this agent used any of its keys yet? Polled by the "Connect your agent"
// panel. Owner-scoped like everything else.
export async function agentConnectionAction(agentId: string): Promise<{ connectedAt: string | null }> {
  const owner = await requireOwner();
  if (!Uuid.safeParse(agentId).success) return { connectedAt: null };
  const [row] = await db
    .select({ lastUsedAt: sql<Date | null>`max(${agentKeys.lastUsedAt})` })
    .from(agentKeys)
    .where(and(eq(agentKeys.agentId, agentId), eq(agentKeys.ownerId, owner.id)));
  return { connectedAt: row?.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null };
}

// ------------------------------------------------------------ AI drafting

export type DraftResult = { ok: true; draft: SlipDraft } | { ok: false; message: string };

// Turns the owner's words into proposed slip fields. Nothing is saved: the
// owner reviews the form and co-signs as usual.
export async function draftSlipAction(agentId: string, words: string): Promise<DraftResult> {
  const owner = await requireOwner();
  if (!Uuid.safeParse(agentId).success) return { ok: false, message: "Missing agent." };
  await getAgent(owner.id, agentId); // only the owner's own agents
  const text = words.trim();
  if (text.length < 5) return { ok: false, message: "Write a sentence or two about what the agent should buy, first." };
  if (text.length > 1000) return { ok: false, message: "Keep it under 1,000 characters." };
  const limited = rateLimit(`draft:${owner.id}`, 10, 60_000);
  if (!limited.ok) return { ok: false, message: `Too many drafts in a row. Try again in ${limited.retryAfter} seconds.` };
  const stores = await listStores();
  return draftSlip({ ownerWords: text, stores: stores.map((s) => ({ id: s.id, name: s.name, categories: s.categories })), today: new Date().toISOString().slice(0, 10) });
}
