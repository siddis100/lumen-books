import { defineRouting } from "next-intl/routing";

/**
 * Locales for Lumen Books.
 * English is the default language, French and Arabic are also served.
 * `localePrefix: "always"` keeps URLs clean and indexable in every language
 * (e.g. /en/books, /fr/books, /ar/books) which is required for hreflang tags.
 */
export const routing = defineRouting({
  locales: ["en", "fr", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const locales = routing.locales;

/** Locales laid out right-to-left. Drives `dir` and all logical CSS utilities. */
export const rtlLocales: readonly Locale[] = ["ar"];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

/** Text direction + language attributes for the `<html>` element. */
export function htmlLangDir(locale: string): { lang: string; dir: "ltr" | "rtl" } {
  return { lang: locale, dir: isRtl(locale) ? "rtl" : "ltr" };
}

/** BCP-47 tags used by `Intl` and by `hreflang` alternates. */
export const localeTags: Record<Locale, string> = {
  en: "en",
  fr: "fr",
  ar: "ar",
};