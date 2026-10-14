// The owner's address book: where their agents' orders ship. Every call is
// scoped to the owner from the session; another owner's address looks like
// "not found". Agents never see an address - only its label.

import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { addresses, slips } from "@/db/schema";
import { notFound, ServiceError } from "./common";

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
  "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // One plain line: no control characters.
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Use plain text.");

export const AddressInput = z.object({
  label: text(40),
  recipient: text(80),
  line1: text(100),
  line2: z.union([text(100), z.literal("")]).optional(),
  city: text(60),
  region: z.enum(US_STATES),
  postal_code: z.string().trim().regex(/^[0-9]{5}(-[0-9]{4})?$/, "Use a 5-digit ZIP code, like 94105 or 94105-1234."),
});
export type AddressInput = z.infer<typeof AddressInput>;
export type Address = typeof addresses.$inferSelect;

export async function listAddresses(ownerId: string): Promise<Address[]> {
  return db.select().from(addresses).where(and(eq(addresses.ownerId, ownerId), isNull(addresses.archivedAt))).orderBy(asc(addresses.createdAt));
}

export async function getAddress(ownerId: string, id: string): Promise<Address> {
  if (!z.uuid().safeParse(id).success) throw notFound("Address");
  const [row] = await db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.ownerId, ownerId), isNull(addresses.archivedAt)));
  if (!row) throw notFound("Address");
  return row;
}

// The address a slip ships to, even if it was removed from the book since.
export async function getAddressForSlip(ownerId: string, id: string): Promise<Address | null> {
  const [row] = await db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.ownerId, ownerId)));
  return row ?? null;
}

const values = (input: AddressInput) => ({
  label: input.label,
  recipient: input.recipient,
  line1: input.line1,
  line2: input.line2 ? input.line2 : null,
  city: input.city,
  region: input.region,
  postalCode: input.postal_code,
});

export async function createAddress(ownerId: string, raw: unknown): Promise<Address> {
  const input = AddressInput.parse(raw);
  const existing = await listAddresses(ownerId);
  if (existing.length >= 20) throw new ServiceError(422, "too_many_addresses", "You can keep up to 20 addresses. Remove one first.");
  const [row] = await db.insert(addresses).values({ ownerId, ...values(input) }).returning();
  return row!;
}

// Editing changes where future orders ship; orders already sent keep their copy.
export async function updateAddress(ownerId: string, id: string, raw: unknown): Promise<Address> {
  await getAddress(ownerId, id);
  const input = AddressInput.parse(raw);
  const [row] = await db
    .update(addresses)
    .set(values(input))
    .where(and(eq(addresses.id, id), eq(addresses.ownerId, ownerId), isNull(addresses.archivedAt)))
    .returning();
  if (!row) throw notFound("Address");
  return row;
}

// Removed addresses stay in the database (slips and orders refer to them) but
// disappear from the book. One that a live slip ships to cannot be removed.
// The address row is locked while checking, and choosing an address for a
// slip locks it too, so a removal and a choice can't both slip through.
export async function archiveAddress(ownerId: string, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw notFound("Address");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.ownerId, ownerId), isNull(addresses.archivedAt)))
      .for("update");
    if (!row) throw notFound("Address");
    const [inUse] = await tx
      .select({ id: slips.id })
      .from(slips)
      .where(and(eq(slips.ownerId, ownerId), eq(slips.shipToAddressId, id), inArray(slips.status, ["AWAITING_HOLDS", "ACTIVE"])));
    if (inUse) throw new ServiceError(409, "address_in_use", "An agent's permission slip ships to this address. Change that slip first.");
    await tx.update(addresses).set({ archivedAt: new Date() }).where(and(eq(addresses.id, id), eq(addresses.ownerId, ownerId)));
  });
}

// The copy kept on an order, and what PayPal gets on a budget hold.
export type ShipTo = { label: string; recipient: string; line1: string; line2: string | null; city: string; region: string; postal_code: string; country_code: string };
export const shipToOf = (a: Address): ShipTo => ({
  label: a.label,
  recipient: a.recipient,
  line1: a.line1,
  line2: a.line2,
  city: a.city,
  region: a.region,
  postal_code: a.postalCode,
  country_code: a.countryCode,
});

// One line for lists: "1 Main St, Suite 2, Springfield, IL 62701".
export const addressSummary = (a: { line1: string; line2: string | null; city: string; region: string; postalCode?: string; postal_code?: string }) =>
  [a.line1, a.line2, a.city, `${a.region} ${a.postalCode ?? a.postal_code ?? ""}`.trim()].filter(Boolean).join(", ");
