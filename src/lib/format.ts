import type { Locale } from "@/i18n/routing";

/**
 * Date formatting shared by the account area and the admin panel.
 *
 * `Intl.DateTimeFormat` is locale-aware, so Arabic orders read naturally in
 * Arabic numerals/labels and the shopper sees a date they recognise.
 */
export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Date + time, used where the exact moment matters (order history, logs). */
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}