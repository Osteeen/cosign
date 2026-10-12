// Approvals bind to this hash: if any part of the cart changes after the owner
// saw it, the hash changes and the approval no longer applies.

import { createHash } from "node:crypto";
import type { SpendRequestInput } from "./types.ts";

export function cartHash(request: SpendRequestInput): string {
  // Fixed key order and explicit fields, so the hash never depends on how the
  // object happened to be built.
  const canonical = JSON.stringify([
    "cosign-cart-v1",
    request.storeId,
    request.total.currency,
    request.total.amountCents,
    request.items.map((i) => [i.name, i.category, i.quantity, i.unitAmountCents]),
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}
