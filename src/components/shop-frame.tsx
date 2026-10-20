import Link from "next/link";
import type { ReactNode } from "react";
import { storePath, type DemoStore } from "@/lib/demo/catalog";

// A demo store's own website - deliberately not Cosign's look, so nobody
// mistakes the store for Cosign. The banner says plainly what it is.
export function ShopFrame({ store, children }: { store: DemoStore; children: ReactNode }) {
  return (
    <div className={`shop shop-${store.accent}`}>
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link href={storePath(store)} className="shop-logo">
            <span className="shop-logo-mark" aria-hidden="true">
              {store.name.charAt(0)}
            </span>
            {store.name}
          </Link>
          <span className="shop-header-links">
            <Link href={`${storePath(store)}/orders`} className="shop-orders-link" aria-label="Orders received">
              <span className="shop-orders-long">Orders received</span>
              <span className="shop-orders-short" aria-hidden="true">
                Orders
              </span>
            </Link>
            <span className="shop-paypal">Accepts PayPal</span>
          </span>
        </div>
      </header>
      <p className="shop-banner">
        <strong>Demo store in the PayPal sandbox.</strong> It stands in for a real PayPal store. AI assistants order here through Cosign, and PayPal pays
        the store.
      </p>
      <main className="shop-main">{children}</main>
    </div>
  );
}
