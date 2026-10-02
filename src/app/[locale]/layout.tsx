import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fontVariables } from "@/lib/fonts";
import { publicEnv } from "@/lib/env";
import { routing, htmlLangDir } from "@/i18n/routing";
import { getCategories } from "@/lib/queries/catalog";
import { getSessionUser } from "@/lib/auth";
import { getLocaleCategoryName } from "@/lib/i18n-helpers";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { DemoBanner } from "@/components/layout/demo-banner";
import "../globals.css";

/**
 * This is the root layout of the storefront: there is no `app/layout.tsx`,
 * because `<html lang dir>` must depend on the `[locale]` segment. Every page
 * lives under `/[locale]`, and API routes / metadata files do not need one.
 *
 * `setRequestLocale` opts this request into static rendering, which is what
 * allows the catalogue to be generated with ISR instead of per request.
 */

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcf9" },
    { media: "(prefers-color-scheme: dark)", color: "#211f1c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
    title: { default: t("defaultTitle"), template: `%s · ${t("siteName")}` },
    description: t("defaultDescription"),
    applicationName: t("siteName"),
    authors: [{ name: t("siteName") }],
    creator: t("siteName"),
    publisher: t("siteName"),
    formatDetection: { email: false, address: false, telephone: false },
    robots: { index: true, follow: true },
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map((code) => [code, `/${code}`]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: t("siteName"),
      title: t("defaultTitle"),
      description: t("defaultDescription"),
      locale: t("ogLocale"),
      url: `/${locale}`,
    },
    twitter: {
      card: "summary_large_image",
      title: t("defaultTitle"),
      description: t("defaultDescription"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const tCommon = await getTranslations("common");
  const [user, categoryRows] = await Promise.all([getSessionUser(), getCategories()]);

  // Categories carry one column per language; pick the active one.
  const categories = categoryRows.map((row) => ({
    slug: row.slug,
    name: getLocaleCategoryName(row, locale),
  }));

  const { lang, dir } = htmlLangDir(locale);

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className={`${fontVariables} h-full`}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col">
        <NextIntlClientProvider locale={locale} timeZone="UTC">
          <Providers>
            <a
              href="#main"
              className="bg-brand text-brand-foreground sr-only rounded-md px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-100"
            >
              {tCommon("skipToContent")}
            </a>
            <DemoBanner />
            <SiteHeader user={user} categories={categories} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter categories={categories} />
            <CookieBanner />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
