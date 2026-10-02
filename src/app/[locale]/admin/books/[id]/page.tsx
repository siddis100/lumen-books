import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BookForm } from "@/components/admin/book-form";
import { BookUploads } from "@/components/admin/book-uploads";
import { DeleteBookButton } from "@/components/admin/delete-book-button";
import { getAdminBook, getAdminCategories } from "@/lib/admin/queries";
import { routing, type Locale } from "@/i18n/routing";

/** Edit one title: metadata, cover art and the customer PDF. */
export default async function EditBookPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.books" });

  const [book, categories] = await Promise.all([getAdminBook(id), getAdminCategories()]);
  if (!book) notFound();

  const hasOrders = book.salesCount > 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">{book.title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("edit")} · /{locale}/books/{book.slug}
          </p>
        </div>
        <a
          href={`/${locale}/books/${book.slug}`}
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          {t("titleField")}
        </a>
      </div>

      <BookForm
        locale={locale}
        bookId={book.id}
        categories={categories.map((category) => ({ id: category.id, name: category.nameEn }))}
        defaults={{
          title: book.title,
          subtitle: book.subtitle ?? "",
          author: book.author,
          slug: book.slug,
          categoryId: book.categoryId ?? "",
          description: book.description,
          excerpt: book.excerpt ?? "",
          priceCents: book.priceCents,
          compareAtCents: book.compareAtCents ?? undefined,
          language: book.language,
          formats: book.formats,
          pages: book.pages ?? undefined,
          isbn: book.isbn ?? "",
          publishedAt: book.publishedAt ?? "",
          isFeatured: book.isFeatured,
          isActive: book.isActive,
          isDemo: book.isDemo,
        }}
      />

      <BookUploads
        bookId={book.id}
        locale={locale}
        coverPath={book.coverPath}
        pdfPath={book.pdfPath}
        pdfSizeBytes={book.pdfSizeBytes}
      />

      <section className="bg-card border-border/70 rounded-xl border p-5">
        <h3 className="font-display text-lg font-semibold">{t("delete")}</h3>
        <div className="mt-4">
          <DeleteBookButton bookId={book.id} title={book.title} locale={locale} hasOrders={hasOrders} />
        </div>
      </section>
    </div>
  );
}