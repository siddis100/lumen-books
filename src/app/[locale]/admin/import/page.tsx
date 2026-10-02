import { ExternalLink } from "lucide-react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ImportDropzone } from "@/components/admin/import-dropzone";
import { listImportDrafts } from "@/app/actions/admin/import";
import { formatDate } from "@/lib/format";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Bulk PDF import. Every file lands as an inactive draft; nothing is ever
 * overwritten or deleted, so a bad batch can simply be unpublished.
 */
export default async function AdminImportPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.import" });
  const drafts = await listImportDrafts(locale);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <ImportDropzone locale={locale} />

      {drafts.length > 0 ? (
        <section aria-label={t("colStatus")} className="bg-card border-border/70 rounded-xl border p-5">
          <h3 className="font-display text-lg font-semibold">{t("imported", { count: drafts.length })}</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {drafts.map((draft) => (
              <li key={draft.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  {draft.title} — {draft.author}
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(draft.createdAt, locale)}</span>
                <a
                  href={`/${locale}/admin/books/${draft.id}`}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  {draft.slug}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}