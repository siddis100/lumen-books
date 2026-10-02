import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { getAllBookSlugs } from "@/lib/queries/catalog";

/**
 * Multilingual sitemap: every URL exists in the three locales and points at its
 * siblings through `alternates.languages`, so Google serves the right language
 * to each visitor instead of guessing from the IP.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const slugs = await getAllBookSlugs();

  const entries: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/books", priority: 0.9, changeFrequency: "daily" },
    { path: "/about", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
    { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/refund", priority: 0.3, changeFrequency: "yearly" },
    ...slugs.map((row) => ({ path: `/books/${row.slug}`, priority: 0.8, changeFrequency: "weekly" as const })),
  ];

  return entries.flatMap((entry) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${entry.path}`,
      lastModified: new Date(),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((code) => [code, `${base}/${code}${entry.path}`]),
        ),
      },
    })),
  );
}
