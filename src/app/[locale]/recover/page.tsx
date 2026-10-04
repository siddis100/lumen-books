import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverLinksForm } from "@/components/checkout/recover-links-form";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates, localeUrl } from "@/lib/seo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recover" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/recover"),
      languages: localeAlternates("/recover"),
    },
  };
}

/**
 * Landing page for buyers who never received — or lost — the email.
 *
 * Indexable would be a liability here: the page is a lookup form, and its
 * existence should not be the reason a customer believes their order is lost.
 */
export default async function RecoverPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "recover" });

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      benefitsTitle={t("benefitsTitle")}
      benefits={[t("benefitEmail"), t("benefitInstant"), t("benefitSecure")]}
    >
      <RecoverLinksForm locale={locale} />
    </AuthShell>
  );
}
