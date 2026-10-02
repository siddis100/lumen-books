import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { FaqList } from "@/components/marketing/faq-list";
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
  const t = await getTranslations({ locale, namespace: "faq" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: localeUrl(locale, "/faq"), languages: localeAlternates("/faq") },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "faq" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  const entries = t.raw("items") as Record<string, { q: string; a: string }>;
  const items = Object.entries(entries).map(([id, entry]) => ({
    id,
    question: entry.q,
    answer: entry.a,
  }));

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={tn("faq")}
        title={t("title")}
        lede={t("lede")}
        breadcrumbs={[{ label: tn("home"), href: "/" }, { label: t("metaTitle") }]}
      />
      <Section>
        <Container className="max-w-3xl">
          <FaqList
            items={items}
            labels={{
              searchPlaceholder: t("searchPlaceholder"),
              noResults: t("noResults"),
              stillHaveQuestions: t("stillHaveQuestions"),
              contactUs: t("contactUs"),
            }}
          />
        </Container>
      </Section>
    </>
  );
}