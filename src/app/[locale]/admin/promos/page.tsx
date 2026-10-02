import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PromoManager } from "@/components/admin/promo-manager";
import { getAdminPromos } from "@/lib/admin/queries";
import { routing, type Locale } from "@/i18n/routing";

/** Discount codes: percentage or fixed amount, with window and usage limits. */
export default async function AdminPromosPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.promos" });
  const promos = await getAdminPromos();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <PromoManager locale={locale} promos={promos} />
    </div>
  );
}