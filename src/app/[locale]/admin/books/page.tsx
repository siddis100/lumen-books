import { Star, Upload } from "lucide-react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { coverUrl } from "@/lib/storage-url";
import { getAdminBooks } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/money";
import { routing, type Locale } from "@/i18n/routing";

/** Catalogue table: every title, published or draft, with its sales figures. */
export default async function AdminBooksPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.books" });
  const rows = await getAdminBooks();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild size="sm">
          <a href={`/${locale}/admin/books/new`}>{t("new")}</a>
        </Button>
      </div>

      <div className="bg-card border-border/70 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>{t("titleField")}</TableHead>
              <TableHead>{t("author")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead className="text-right">{t("price")}</TableHead>
              <TableHead className="text-right">{t("sales")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground py-10 text-center text-sm">
                  —
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ book, categorySlug, orderCount }) => (
                <TableRow key={book.id}>
                  <TableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl(book.coverPath)}
                      alt=""
                      width={36}
                      height={52}
                      className="h-13 w-9 rounded object-cover"
                    />
                  </TableCell>
                  <TableCell className="max-w-64">
                    <a href={`/${locale}/admin/books/${book.id}`} className="font-medium hover:underline">
                      {book.title}
                    </a>
                    {book.subtitle ? (
                      <span className="text-muted-foreground block truncate text-xs">{book.subtitle}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{book.author}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{categorySlug ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(book.priceCents)}
                    {book.compareAtCents ? (
                      <span className="text-muted-foreground ml-1 text-xs line-through">
                        {formatPrice(book.compareAtCents)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5" aria-hidden />
                      {book.salesCount}
                    </span>
                    <span className="text-muted-foreground block text-xs">{orderCount}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={book.isActive ? "default" : "secondary"}>
                        {book.isActive ? t("active") : "—"}
                      </Badge>
                      {book.isFeatured ? <Badge variant="outline">{t("featured")}</Badge> : null}
                      {book.isDemo ? <Badge variant="outline">{t("isDemo")}</Badge> : null}
                      {!book.pdfPath ? <Badge variant="destructive">{t("missingPdf")}</Badge> : null}
                      {!book.coverPath ? <Badge variant="outline">{t("missingCover")}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/${locale}/admin/books/${book.id}#pdf`}>
                          <Upload className="size-4" aria-hidden />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/${locale}/admin/books/${book.id}`}>{t("edit")}</a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}