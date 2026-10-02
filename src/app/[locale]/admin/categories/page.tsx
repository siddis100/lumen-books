import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CategoryManager } from "@/components/admin/category-manager";
import { getAdminCategories } from "@/lib/admin/queries";
import { routing, type Locale } from "@/i18n/routing";

/** Create, rename (per locale), reorder and delete catalogue categories. */
export default async function AdminCategoriesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.categories" });
  const categories = await getAdminCategories();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <CategoryManager locale={locale} categories={categories} />
    </div>
  );
}