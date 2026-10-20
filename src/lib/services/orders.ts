// Order handoff: what a store must ship for a paid purchase.
//
// An order is created in the same transaction that marks a purchase paid. It
// carries the items, the total and a copy of the slip's ship-to address. The
// store opens it with a private link: an HMAC of the order ID under a key
// derived for this purpose only, so nothing secret is stored and the owner can
// always get the link again. The agent never sees the address, only its label.

import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { addresses, agents, orders, slips, spendRequests, stores } from "@/db/schema";
import { DEMO_OWNER_ID } from "@/lib/demo/account";
import { shipToOf, type ShipTo } from "./addresses";
import { appUrl, logActivity, notFound, ServiceError, type Tx } from "./common";

export type Order = typeof orders.$inferSelect;
type SpendRow = typeof spendRequests.$inferSelect;

function linkKey(): Buffer {
  const root = process.env.AUTH_SECRET;
  if (!root) throw new Error("AUTH_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", root, "cosign-order-link", "v1", 32));
}

export const orderToken = (orderId: string) => createHmac("sha256", linkKey()).update(`order:${orderId}`).digest("base64url");
export const orderLink = (orderId: string) => `${appUrl()}/orders/${orderId}?t=${orderToken(orderId)}`;

function tokenMatches(orderId: string, token: string): boolean {
  const expected = Buffer.from(orderToken(orderId));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Inside the transaction that marks the purchase paid. Once per purchase.
// A capture PayPal accepted as PENDING makes an order the store must not ship yet.
export async function createOrderForPaidPurchase(tx: Tx, row: SpendRow, opts: { paymentPending: boolean }): Promise<void> {
  const [slip] = row.slipId ? await tx.select({ shipTo: slips.shipToAddressId }).from(slips).where(eq(slips.id, row.slipId)) : [];
  const [address] = slip?.shipTo
    ? await tx.select().from(addresses).where(and(eq(addresses.id, slip.shipTo), eq(addresses.ownerId, row.ownerId)))
    : [];
  await tx
    .insert(orders)
    .values({
      ownerId: row.ownerId,
      agentId: row.agentId,
      storeId: row.storeId,
      spendRequestId: row.id,
      items: row.items,
      totalCents: row.totalCents,
      shipTo: address ? shipToOf(address) : null,
      paymentPending: opts.paymentPending,
    })
    .onConflictDoNothing({ target: orders.spendRequestId });
}

// PayPal confirmed a capture that was PENDING: the store may ship now.
export async function confirmOrderPayment(spendRequestId: string): Promise<boolean> {
  const updated = await db
    .update(orders)
    .set({ paymentPending: false })
    .where(and(eq(orders.spendRequestId, spendRequestId), eq(orders.paymentPending, true)))
    .returning({ id: orders.id });
  return updated.length > 0;
}

// The store will not be paid (PayPal denied or reversed it, or a full refund):
// an order not yet shipped is cancelled. Callers hold the purchase's row lock,
// the same lock "mark as shipped" takes first, so the two never cross.
// Returns "shipped" when it is too late - the store already sent the goods.
export async function cancelOrderForPurchase(tx: Tx, spendRequestId: string): Promise<"cancelled" | "shipped" | "none"> {
  const [current] = await tx.select().from(orders).where(eq(orders.spendRequestId, spendRequestId)).for("update");
  if (!current || current.status === "CANCELLED") return "none";
  if (current.status === "SHIPPED") return "shipped";
  await tx.update(orders).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(orders.id, current.id));
  return "cancelled";
}

// ----------------------------------------------------------- store side

export type StoreOrderView = {
  order: Order;
  storeName: string;
  shipTo: ShipTo | null;
  demo: boolean;
};

function checkLink(orderId: string, token: string) {
  if (!z.uuid().safeParse(orderId).success || !token || token.length > 100 || !tokenMatches(orderId, token)) throw notFound("Order");
}

// A store opening its private link. Wrong or missing token: "not found".
// Opening changes nothing (link previews and scanners open links too).
export async function openOrderAsStore(orderId: string, token: string): Promise<StoreOrderView> {
  checkLink(orderId, token);
  const [row] = await db.select({ order: orders, storeName: stores.name }).from(orders).innerJoin(stores, eq(stores.id, orders.storeId)).where(eq(orders.id, orderId));
  if (!row) throw notFound("Order");
  return { order: row.order, storeName: row.storeName, shipTo: row.order.shipTo as ShipTo | null, demo: row.order.ownerId === DEMO_OWNER_ID };
}

// The store's buttons. Each locks the purchase first, then the order - the
// same order as a reversal - and re-checks that the payment still stands.
async function storeStep(orderId: string, token: string, step: "confirm" | "ship"): Promise<Order> {
  checkLink(orderId, token);
  const [found] = await db.select({ spendRequestId: orders.spendRequestId }).from(orders).where(eq(orders.id, orderId));
  if (!found) throw notFound("Order");
  return db.transaction(async (tx) => {
    const [spend] = await tx.select({ status: spendRequests.status }).from(spendRequests).where(eq(spendRequests.id, found.spendRequestId)).for("update");
    const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!current || !spend) throw notFound("Order");
    if (current.status === "CANCELLED" || spend.status !== "COMPLETED") return current;
    if (current.paymentPending) throw new ServiceError(409, "payment_pending", "PayPal has not confirmed this payment yet. Please do not ship until it does.");
    if (step === "confirm") {
      if (current.status !== "SENT") return current;
      const [updated] = await tx.update(orders).set({ status: "SEEN", seenAt: new Date() }).where(eq(orders.id, orderId)).returning();
      return updated!;
    }
    if (current.status === "SHIPPED") return current;
    const [updated] = await tx
      .update(orders)
      .set({ status: "SHIPPED", shippedAt: new Date(), seenAt: current.seenAt ?? new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    const [store] = await tx.select({ name: stores.name }).from(stores).where(eq(stores.id, current.storeId));
    await logActivity(tx, {
      ownerId: current.ownerId,
      agentId: current.agentId,
      spendRequestId: current.spendRequestId,
      type: "ORDER_SHIPPED",
      amountCents: current.totalCents,
      summary: `${store?.name ?? "The store"} marked your order as shipped`,
    });
    return updated!;
  });
}

export const confirmOrder = (orderId: string, token: string) => storeStep(orderId, token, "confirm");
export const markOrderShipped = (orderId: string, token: string) => storeStep(orderId, token, "ship");

// Orders from the demo account only, for a demo store's "Orders received" page.
export async function demoOrdersForStore(storeName: string) {
  return db
    .select({ order: orders, agent: agents.name })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .innerJoin(agents, eq(agents.id, orders.agentId))
    .where(and(eq(orders.ownerId, DEMO_OWNER_ID), eq(stores.name, storeName)))
    .orderBy(desc(orders.createdAt))
    .limit(50);
}

// ----------------------------------------------------------- owner side

// The orders behind some of this owner's purchases, keyed by purchase.
export async function ordersForPurchases(ownerId: string, spendRequestIds: string[]): Promise<Map<string, Order>> {
  if (spendRequestIds.length === 0) return new Map();
  const rows = await db.select().from(orders).where(and(eq(orders.ownerId, ownerId), inArray(orders.spendRequestId, spendRequestIds)));
  return new Map(rows.map((o) => [o.spendRequestId, o]));
}
