import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUsd } from "@/lib/money";
import { DEMO_STORES, findProduct, findStore, storePath } from "@/lib/demo/catalog";
import { ShopFrame } from "@/components/shop-frame";

type Params = Promise<{ store: string; product: string }>;

export function generateStaticParams() {
  return DEMO_STORES.flatMap((s) => s.products.map((p) => ({ store: s.slug, product: p.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { store: s, product: p } = await params;
  const store = findStore(s);
  const product = store ? findProduct(store, p) : null;
  return { title: store && product ? `${product.name} - ${store.name}` : "Product not found" };
}

// ?reveal=1 shows the hidden agent note for the demo video; normally it is in
// the page's HTML but not on screen, as a real injected note would be.
export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: Promise<{ reveal?: string }> }) {
  const { store: s, product: p } = await params;
  const store = findStore(s);
  const product = store ? findProduct(store, p) : null;
  if (!store || !product) notFound();
  const reveal = (await searchParams).reveal === "1";

  return (
    <ShopFrame store={store}>
      <nav className="shop-crumbs" aria-label="Breadcrumb">
        <Link href={storePath(store)}>All products</Link>
      </nav>
      <article className="shop-product">
        <h1 className="shop-title">{product.name}</h1>
        <p className="shop-product-price">
          {formatUsd(product.priceCents)} <span className="shop-unit">/ {product.unit}</span>
        </p>
        <p>{product.description}</p>
        <dl className="shop-facts">
          <div>
            <dt>Sold by</dt>
            <dd>{store.name}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>PayPal</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd>In stock</dd>
          </div>
        </dl>
        {product.agentNote ? (
          reveal ? (
            <div className="agent-note-revealed">
              <span className="agent-note-label">Hidden text on this page - people cannot see it, but bots that read the page can.</span>
              <p className="agent-note">{product.agentNote}</p>
            </div>
          ) : (
            <p className="agent-note" hidden>
              {product.agentNote}
            </p>
          )
        ) : null}
        <p className="shop-howto">This demo store only receives orders from AI assistants through Cosign. People cannot check out here.</p>
      </article>
    </ShopFrame>
  );
}
