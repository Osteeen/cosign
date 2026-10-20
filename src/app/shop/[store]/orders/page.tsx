import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopFrame } from "@/components/shop-frame";
import { LocalTime } from "@/components/local-time";
import { demoEnabled } from "@/lib/demo/account";
import { findStore, storePath } from "@/lib/demo/catalog";
import { formatUsd } from "@/lib/money";
import { demoOrdersForStore, orderLink } from "@/lib/services/orders";

// The demo store's side of order handoff: orders its Cosign customers' agents
// paid for. Lists ONLY the shared demo account's orders (a sample address), so
// no real owner's address is ever shown here. Real stores open each order with
// its own private link instead.
export const metadata: Metadata = { title: "Orders received - demo store", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { SENT: "New", SEEN: "Seen", SHIPPED: "Shipped", CANCELLED: "Cancelled" };

export default async function DemoStoreOrdersPage({ params }: { params: Promise<{ store: string }> }) {
  const store = findStore((await params).store);
  if (!store || !demoEnabled()) notFound();
  const orders = await demoOrdersForStore(store.name);

  return (
    <ShopFrame store={store}>
      <h1 className="shop-title">Orders received</h1>
      <p className="shop-note">
        <strong>Store view (demo).</strong> What {store.name} sees when AI agents buy here through Cosign: the items and where to ship them. Only orders
        from the Cosign demo account appear here. A real store gets a private link for each order.
      </p>
      {orders.length === 0 ? (
        <p className="shop-note">No orders yet. Run the demo bot in the Cosign demo account, then come back.</p>
      ) : (
        <ul className="shop-orders">
          {orders.map(({ order, agent }) => {
            const items = order.items as { name: string; quantity: number }[];
            return (
              <li key={order.id}>
                <a href={orderLink(order.id)} className="shop-order">
                  <span className="shop-order-what">{items.map((i) => `${i.quantity} x ${i.name}`).join(", ")}</span>
                  <span className="shop-order-meta">
                    <LocalTime iso={order.createdAt.toISOString()} /> - from {agent} - {STATUS[order.status]}
                  </span>
                  <span className="shop-card-price">{formatUsd(order.totalCents)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <p>
        <Link href={storePath(store)}>Back to the store</Link>
      </p>
    </ShopFrame>
  );
}
