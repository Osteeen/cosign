// Channel3 product search: live prices for the same kind of product at other
// retailers. Read-only; the key comes from the environment and is never logged.

import "server-only";

export type MarketOffer = { title: string; domain: string; price: number };

const TIMEOUT_MS = 8_000;

// Up to `limit` in-stock USD offers for the query, one per product.
// Returns null when Channel3 is not configured or does not answer.
export async function searchMarket(query: string, limit = 8): Promise<MarketOffer[] | null> {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.trychannel3.com/v1/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.slice(0, 200), limit: 15 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[channel3] search failed (HTTP ${res.status})`);
      return null;
    }
    const body = (await res.json()) as {
      products?: { title?: string; offers?: { domain?: string; availability?: string; price?: { price?: number; currency?: string } }[] }[];
    };
    const offers: MarketOffer[] = [];
    const seen = new Set<string>();
    for (const p of body.products ?? []) {
      const o = p.offers?.find((x) => x.availability === "InStock" && x.price?.currency === "USD" && typeof x.price.price === "number");
      if (!o || !p.title || !o.domain) continue;
      const id = `${p.title}|${o.domain}`;
      if (seen.has(id)) continue;
      seen.add(id);
      offers.push({ title: p.title.slice(0, 140), domain: o.domain.slice(0, 80), price: o.price!.price! });
      if (offers.length === limit) break;
    }
    return offers;
  } catch (e) {
    console.error(`[channel3] search unavailable (${e instanceof Error ? e.name : "error"})`);
    return null;
  }
}
