// Money is integer cents everywhere. These are the only places cents become
// strings, and strings become cents.

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

// PayPal amounts are decimal strings like "12.34".
export function centsToPayPal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 1) throw new RangeError("amount must be positive cents");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function payPalToCents(value: string): number {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value);
  if (!m) throw new RangeError(`unexpected PayPal amount: ${value}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

// Owner input like "200", "200.5", "$1,250.00" -> cents. Null when invalid.
export function parseDollars(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
