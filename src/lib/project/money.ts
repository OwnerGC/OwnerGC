// Money in the database is whole cents (integers), so totals never drift by a
// penny. These helpers turn what people type into cents and back.

/** "$12,345.67" or "12345.6" -> 1234567. Returns null for anything unreadable. */
export function dollarsToCents(input: unknown, { allowNegative = false } = {}): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[$,\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = true;
    s = s.slice(1);
  }
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  if (!Number.isSafeInteger(cents)) return null;
  if (negative && !allowNegative) return null;
  return negative ? -cents : cents;
}

/** 1234567 -> "$12,345.67" (or "$12,346" with whole: true). */
export function formatCents(cents: number, { whole = false } = {}): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/** 1234567 -> "12345.67", for pre-filling an input box. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
