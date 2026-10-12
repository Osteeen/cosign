import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUsd } from "@/lib/money";
import { DEMO_STORES, findStore, storePath } from "@/lib/demo/catalog";
import { ShopFrame } from "@/components/shop-frame";

export function generateStaticParams() {
  return DEMO_STORES.map((s) => ({ store: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  const store = findStore((await params).store);
  return { title: store ? `${store.name} - demo store` : "Store not found" };
}

export default async function StorePage({ params }: { params: Promise<{ store: string }> }) {
  const store = findStore((await params).store);
  if (!store) notFound();
  return (
    <ShopFrame store={store}>
      <h1 className="shop-title">{store.tagline}</h1>
      <ul className="shop-grid">
        {store.products.map((p) => (
          <li key={p.slug}>
            <Link href={`${storePath(store)}/${p.slug}`} className="shop-card" data-product={p.slug} data-price-cents={p.priceCents} data-category={p.category}>
              <span className="shop-card-name">{p.name}</span>
              <span className="shop-card-price">
                {formatUsd(p.priceCents)} <span className="shop-unit">/ {p.unit}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ShopFrame>
  );
}
