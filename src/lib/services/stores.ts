import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";

// Stores are a platform-wide directory (onboarded through PayPal Partner
// Referrals). PayPal merchant IDs never leave the server.
export async function listStores() {
  return db
    .select({ id: stores.id, name: stores.name, categories: stores.categories, website: stores.website })
    .from(stores)
    .orderBy(asc(stores.name));
}

export async function storeMerchantIds(storeIds: string[]): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const rows = await db
    .select({ id: stores.id, merchantId: stores.paypalMerchantId })
    .from(stores)
    .where(inArray(stores.id, [...new Set(storeIds)]));
  return new Map(rows.map((r) => [r.id, r.merchantId]));
}
