import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookForm } from "@/components/admin/book-form";
import { getAdminCategories } from "@/lib/admin/queries";
import { routing, type Locale } from "@/i18n/routing";

/** Create a title. Slug and price are filled in by the admin, defaults are safe. */
export default async function NewBookPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.books" });
  const categories = await getAdminCategories();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("new")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <BookForm
        locale={locale}
        categories={categories.map((category) => ({ id: category.id, name: category.nameEn }))}
      />
    </div>
  );
}