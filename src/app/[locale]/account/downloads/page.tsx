import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/layout";
import { LibraryGrid } from "@/components/account/library-grid";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getLibrary } from "@/lib/account";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { routing, type Locale } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.downloads" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/account/downloads"),
      languages: localeAlternates("/account/downloads"),
    },
  };
}

export default async function AccountDownloadsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  // Only paid + webhook-confirmed orders reach the library.
  const entries = await getLibrary(user.id);
  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{t("downloads.title")}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{t("downloads.subtitle")}</p>

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t("downloads.none")}
            action={
              <Button asChild variant="outline">
                <a href={`/${locale}/books`}>{t("downloads.noneCta")}</a>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <LibraryGrid entries={entries} />
          </div>
          <p className="text-muted-foreground mt-4 text-xs">{t("downloads.expiresIn")}</p>
        </>
      )}
    </section>
  );
}