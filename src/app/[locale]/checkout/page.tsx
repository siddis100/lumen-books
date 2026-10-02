import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { CheckoutClient } from "@/components/checkout/checkout-client";
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
  const t = await getTranslations({ locale, namespace: "checkout" });
  return {
    title: t("metaTitle"),
    description: t("subtitle"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/checkout"),
      languages: localeAlternates("/checkout"),
    },
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ promo?: string }>;
}) {
  const { locale } = await params;
  const { promo } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "checkout" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={tn("cart")}
        title={t("title")}
        lede={t("subtitle")}
        breadcrumbs={[
          { label: tn("home"), href: "/" },
          { label: tn("cart"), href: "/cart" },
          { label: t("title") },
        ]}
      />
      <Section>
        <Container>
          <CheckoutClient promoCode={promo} />
        </Container>
      </Section>
    </>
  );
}
