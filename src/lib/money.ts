/**
 * The only module allowed to touch money values.
 *
 * Every amount in the database is an integer number of USD cents, which avoids
 * floating-point rounding errors. Prices are ALWAYS recomputed server-side from
 * the database — the client never sends an amount it wants to pay.
 */

/** Single currency for the whole store. */
export const CURRENCY = "USD" as const;

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format USD cents for display, e.g. `formatPrice(1299)` → `$12.99`.
 * The `$x.xx` shape is intentional and identical in every locale.
 */
export function formatPrice(cents: number): string {
  return USD.format(cents / 100);
}

/** Same as `formatPrice` but without the currency symbol (for input fields). */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** `"12.99"` → `1299`. Returns `null` for anything that is not a valid price. */
export function parsePriceToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const value = typeof input === "number" ? input : Number.parseFloat(String(input).replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Convert a USD cents integer to the string the PayPal Orders API expects. */
export function centsToPayPalAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert a PayPal amount string ("12.99") back to cents, or `null` if invalid. */
export function paypalAmountToCents(amount: string): number | null {
  return parsePriceToCents(amount);
}

/** Percentage off, applied to a cents amount and rounded to the nearest cent. */
export function applyPercentDiscount(cents: number, percent: number): number {
  const discount = Math.round((cents * percent) / 100);
  return Math.min(discount, cents);
}