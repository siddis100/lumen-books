import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { CartView } from "@/components/cart/cart-view";
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
  const t = await getTranslations({ locale, namespace: "cart" });
  return {
    title: t("metaTitle"),
    description: t("emptyHint"),
    // Private transaction page: never index it.
    robots: { index: false, follow: false },
    alternates: { canonical: localeUrl(locale, "/cart"), languages: localeAlternates("/cart") },
  };
}

export default async function CartPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={tn("cart")}
        title={t("title")}
        breadcrumbs={[{ label: tn("home"), href: "/" }, { label: t("title") }]}
      />
      <Section>
        <Container>
          <CartView />
        </Container>
      </Section>
    </>
  );
}
