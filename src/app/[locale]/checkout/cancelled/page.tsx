import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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
    title: t("cancelled"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/checkout/cancelled"),
      languages: localeAlternates("/checkout/cancelled"),
    },
  };
}

export default async function CheckoutCancelledPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "checkout" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className="bg-muted/30 flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <AlertCircle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-semibold">{t("cancelled")}</h1>
        <p className="text-muted-foreground text-sm">{t("failedBody")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/cart">{t("backToCart")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/books">{tn("books")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
