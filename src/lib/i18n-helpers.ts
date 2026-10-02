import type { Locale } from "@/i18n/routing";
import type { CategoryRow } from "@/lib/queries/catalog";

/**
 * Small helpers to pick the right translation out of a database row.
 *
 * Categories store one column per supported language (name_en / name_fr / …).
 * When a translation is missing we fall back to English, which is the source
 * language, so the storefront never renders an empty label.
 */

type Translated = {
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionFr: string | null;
  descriptionAr: string | null;
};

export function getLocaleCategoryName(
  row: Translated,
  locale: Locale | string,
): string {
  if (locale === "fr" && row.nameFr) return row.nameFr;
  if (locale === "ar" && row.nameAr) return row.nameAr;
  return row.nameEn;
}

export function getLocaleCategoryDescription(
  row: Translated,
  locale: Locale | string,
): string | null {
  if (locale === "fr" && row.descriptionFr) return row.descriptionFr;
  if (locale === "ar" && row.descriptionAr) return row.descriptionAr;
  return row.descriptionEn ?? null;
}

export type { CategoryRow };

/** Human label for an ISO language code stored on a book. */
const LANGUAGE_NAMES: Record<string, Record<Locale, string>> = {
  en: { en: "English", fr: "Anglais", ar: "الإنجليزية" },
  fr: { en: "French", fr: "Français", ar: "الفرنسية" },
  ar: { en: "Arabic", fr: "Arabe", ar: "العربية" },
  es: { en: "Spanish", fr: "Espagnol", ar: "الإسبانية" },
  de: { en: "German", fr: "Allemand", ar: "الألمانية" },
  it: { en: "Italian", fr: "Italien", ar: "الإيطالية" },
  pt: { en: "Portuguese", fr: "Portugais", ar: "البرتغالية" },
};

export function languageName(code: string, locale: Locale | string): string {
  const entry = LANGUAGE_NAMES[code.toLowerCase()];
  if (!entry) return code.toUpperCase();
  return entry[locale as Locale] ?? entry.en;
}

/** ISO 639-1 + optional region, used by the `hreflang` and `og:locale` tags. */
export function toBcp47(code: string): string {
  return code === "en" ? "en" : code;
}
