import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutSuccess } from "@/components/checkout/checkout-success";
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
    title: t("success"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/checkout/success"),
      languages: localeAlternates("/checkout/success"),
    },
  };
}

/**
 * PayPal returns here with `token` (PayPal order id) and optionally `PayerID`.
 * The component captures the order, then polls until the webhook confirms it.
 */
export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ token?: string; order?: string }>;
}) {
  const { locale } = await params;
  const { token, order } = await searchParams;
  setRequestLocale(locale);

  // The page must still render if PayPal omits `order` in the redirect (rare),
  // but we pass what we have. The client will refuse to proceed if either is
  // missing when calling the API.
  return (
    <div className="bg-muted/30 flex min-h-[60vh] items-center justify-center py-10">
      <CheckoutSuccess orderNumber={order ?? ""} paypalOrderId={token ?? ""} />
    </div>
  );
}
