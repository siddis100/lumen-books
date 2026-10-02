import Image from "next/image";
import { FileText, Sparkles } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RatingStars } from "@/components/common/rating-stars";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/money";
import { coverUrl } from "@/lib/storage-url";
import { languageName } from "@/lib/i18n-helpers";
import { cn } from "@/lib/utils";
import type { BookRow } from "@/lib/queries/catalog";

export type BookCardData = Pick<
  BookRow,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "author"
  | "priceCents"
  | "compareAtCents"
  | "coverPath"
  | "ratingAvg"
  | "ratingCount"
  | "language"
  | "isDemo"
  | "isFeatured"
> & { categoryName?: string | null };

/**
 * Catalogue card: cover, title, author, rating and price.
 * Entirely server-rendered so the catalogue can be statically generated.
 */
export async function BookCard({
  book,
  categoryName,
  priority = false,
  className,
  sizes = "(min-width: 1280px) 280px, (min-width: 768px) 33vw, 45vw",
}: {
  book: BookCardData;
  categoryName?: string | null;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const t = await getTranslations("book");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();

  const discount =
    book.compareAtCents && book.compareAtCents > book.priceCents
      ? Math.round((1 - book.priceCents / book.compareAtCents) * 100)
      : null;

  return (
    <article
      className={cn(
        "group bg-card relative flex h-full flex-col overflow-hidden rounded-xl border p-3 transition-all hover:border-border hover:shadow-md",
        className,
      )}
    >
      <Link
        href={`/books/${book.slug}`}
        className="focus-visible:ring-ring/60 flex flex-col gap-3 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="book-cover-frame relative aspect-2/3 w-full overflow-hidden rounded-lg">
          <Image
            src={coverUrl(book.coverPath)}
            alt={`${book.title} — cover`}
            fill
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : "lazy"}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            {book.isFeatured ? (
              <Badge className="bg-brand text-brand-foreground shadow-sm">
                <Sparkles className="size-3" aria-hidden="true" />
                {t("bestsellerBadge")}
              </Badge>
            ) : (
              <span />
            )}
            {discount ? (
              <Badge className="bg-destructive text-white shadow-sm">-{discount}%</Badge>
            ) : null}
          </div>
          {book.isDemo ? (
            <Badge
              variant="secondary"
              className="bg-background/90 absolute bottom-2 start-2 shadow-sm backdrop-blur-sm"
            >
              {tCommon("demoBadge")}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {categoryName ? (
            <p className="text-brand text-[11px] font-semibold tracking-wide uppercase">
              {categoryName}
            </p>
          ) : null}
          <h3 className="font-display line-clamp-2 text-sm leading-snug font-semibold text-balance">
            {book.title}
          </h3>
          <p className="text-muted-foreground line-clamp-1 text-xs">{book.author}</p>

          <div className="mt-auto flex items-center gap-2 pt-1.5">
            {Number(book.ratingCount) > 0 ? (
              <RatingStars
                value={Number(book.ratingAvg)}
                size="xs"
                showValue
                count={book.ratingCount}
              />
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                <FileText className="size-3" aria-hidden="true" />
                {t("formatsShort")}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-sm font-bold tabular-nums">{formatPrice(book.priceCents)}</span>
            {discount ? (
              <span className="text-muted-foreground text-xs line-through tabular-nums">
                {formatPrice(book.compareAtCents!)}
              </span>
            ) : null}
            <span className="text-muted-foreground ms-auto text-[10px] uppercase">
              {languageName(book.language, locale)}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
