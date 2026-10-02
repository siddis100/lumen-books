import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Central SEO helpers.
 *
 * - `siteUrl()` is the canonical origin (used for metadataBase and OG images).
 * - `localeAlternates()` builds the hreflang map Next.js turns into
 *   `<link rel="alternate">` tags, so each page is discoverable in the other
 *   languages.
 */

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Builds a localised absolute URL: `/fr/books` for locale `fr`.
 * `path` must start with a slash and must NOT include the locale.
 */
export function localeUrl(locale: Locale, path = "/"): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return absoluteUrl(`/${locale}${clean}`);
}

/** hreflang map for a given unlocalised path. */
export function localeAlternates(path = "/") {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, localeUrl(locale, path)]),
  );
}

/** ISO 639-1 for Open Graph (`en_US`, `fr_FR`, `ar_AR`). */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  ar: "ar_AR",
};

/**
 * Page-level metadata with hreflang alternates and a canonical URL.
 * The title is intentionally left empty for pages that set their own template.
 */
export function headerMetadata(options: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  images?: { url: string; width: number; height: number; alt: string }[];
}): Metadata {
  const url = localeUrl(options.locale, options.path);
  return {
    title: options.title,
    description: options.description,
    keywords: options.keywords,
    alternates: { canonical: url, languages: localeAlternates(options.path) },
    openGraph: {
      type: "website",
      siteName: "Lumen Books",
      locale: OG_LOCALE[options.locale],
      alternateLocale: routing.locales.filter((code) => code !== options.locale).map((code) => OG_LOCALE[code]),
      title: options.title,
      description: options.description,
      url,
      images: options.images,
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
    },
    robots: options.noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}

/** Layout metadata for the whole site (title template + default OG image). */
export function siteMetadata(locale: Locale): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: "Lumen Books — Independent eBooks for Curious Minds",
      template: `%s | Lumen Books`,
    },
    description:
      "A curated international catalogue of eBooks you can download instantly and read anywhere.",
    applicationName: "Lumen Books",
    authors: [{ name: "Lumen Books" }],
    creator: "Lumen Books",
    publisher: "Lumen Books",
    category: "books",
    formatDetection: { email: false, address: false, telephone: false },
    alternates: { canonical: localeUrl(locale, "/"), languages: localeAlternates("/") },
    openGraph: {
      type: "website",
      siteName: "Lumen Books",
      locale: OG_LOCALE[locale],
      title: "Lumen Books — Independent eBooks for Curious Minds",
      description: "A curated international catalogue of eBooks you can download instantly.",
      url: localeUrl(locale, "/"),
    },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/favicon.ico", apple: "/apple-icon.png" },
  };
}

/**
 * JSON-LD graph. Every page can pass extra nodes; the returned array is
 * rendered inside a single `<script type="application/ld+json">`.
 */
export function jsonLd(nodes: unknown[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean),
  });
}