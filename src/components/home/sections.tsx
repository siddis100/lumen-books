import { ArrowRight, Compass, LibraryBig, Sparkles, Timer } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/common/layout";
import { BookCard, type BookCardData } from "@/components/book/book-card";
import {
  getBestsellers,
  getCategories,
  getNewReleases,
  getRecentReviews,
} from "@/lib/queries/catalog";
import {
  getLocaleCategoryDescription,
  getLocaleCategoryName,
} from "@/lib/i18n-helpers";
import { RatingStars } from "@/components/common/rating-stars";
import { Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type ShelfEntry = { book: BookCardData; categorySlug: string | null };

/** Reusable "grid of book cards" block used by best-sellers and new releases. */
async function BookShelf({
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  books,
  priority = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
  books: ShelfEntry[];
  priority?: boolean;
}) {
  if (books.length === 0) return null;

  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          action={
            <Button asChild variant="ghost" className="group h-9 px-3">
              <Link href={ctaHref}>
                {ctaLabel}
                <ArrowRight
                  className="rtl-flip size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Button>
          }
        />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {books.map(({ book }, index) => (
            <li key={book.id}>
              <BookCard
                book={book}
                priority={priority && index < 4}
                sizes="(min-width: 1280px) 300px, (min-width: 640px) 33vw, 45vw"
              />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export async function Bestsellers() {
  const t = await getTranslations("home.bestsellers");
  return (
    <BookShelf
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      ctaHref="/books?sort=bestselling"
      ctaLabel={t("cta")}
      books={await getBestsellers(8)}
    />
  );
}

export async function NewReleases() {
  const t = await getTranslations("home.newReleases");
  return (
    <BookShelf
      eyebrow={t("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      ctaHref="/books?sort=newest"
      ctaLabel={t("cta")}
      books={await getNewReleases(4)}
    />
  );
}

/** Category grid with the localised label and description. */
export async function CategoryGrid() {
  const t = await getTranslations("home.categories");
  const locale = await getLocale();
  const rows = await getCategories();
  if (rows.length === 0) return null;

  const icons = [Compass, LibraryBig, Sparkles, Timer];

  return (
    <Section className="bg-muted/40 border-y">
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          action={
            <Button asChild variant="ghost" className="h-9 px-3">
              <Link href="/books">
                {t("cta")}
                <ArrowRight className="rtl-flip size-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, index) => {
            const Icon = icons[index % icons.length];
            const description = getLocaleCategoryDescription(row, locale);
            return (
              <li key={row.id}>
                <Link
                  href={{ pathname: "/books", query: { category: row.slug } }}
                  className="bg-card hover:border-brand/40 group flex items-start gap-4 rounded-xl border p-4 transition-colors"
                >
                  <span className="bg-brand/10 text-brand grid size-10 shrink-0 place-items-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block text-sm font-semibold">
                      {getLocaleCategoryName(row, locale)}
                    </span>
                    {description ? (
                      <span className="text-muted-foreground mt-1 block text-xs text-pretty">
                        {description}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-brand ms-auto size-4 shrink-0 transition-colors rtl-flip"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}

/** Six reasons to buy here, rendered as a compact icon grid. */
export async function Features() {
  const t = await getTranslations("home.features");
  const items = [
    { icon: Timer, ...t.raw("items.instant") },
    { icon: Sparkles, ...t.raw("items.secure") },
    { icon: LibraryBig, ...t.raw("items.lifetime") },
    { icon: Compass, ...t.raw("items.curated") },
    { icon: LibraryBig, ...t.raw("items.anyDevice") },
    { icon: Sparkles, ...t.raw("items.support") },
  ] as { icon: typeof Timer; title: string; description: string }[];

  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          align="center"
          className="text-center"
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <span className="bg-brand/10 text-brand grid size-9 shrink-0 place-items-center rounded-lg">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span>
                <span className="font-display block text-sm font-semibold">{title}</span>
                <span className="text-muted-foreground mt-1 block text-sm text-pretty">
                  {description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/**
 * Reader testimonials. Real, approved reviews take over as soon as the
 * catalogue has some; the curated quotes keep the section complete before that.
 */
export async function Testimonials() {
  const t = await getTranslations("home.testimonials");
  const reviews = await getRecentReviews(3);
  const curated = [t.raw("items.first"), t.raw("items.second"), t.raw("items.third")];

  const entries =
    reviews.length > 0
      ? reviews.map((review) => ({
          quote: review.body,
          name: review.authorName,
          detail: review.title ?? review.bookTitle,
          rating: review.rating,
          slug: review.bookSlug,
        }))
      : curated.map((item) => ({ ...item, rating: 5, slug: null }));

  return (
    <Section className="bg-muted/40 border-y">
      <Container>
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          align="center"
        />
        <ul className="grid gap-4 md:grid-cols-3">
          {entries.map((entry, index) => (
            <li key={`${entry.name}-${index}`}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <Quote className="text-brand/40 size-6" aria-hidden="true" />
                  <blockquote className="text-sm text-pretty">“{entry.quote}”</blockquote>
                  <div className="mt-auto pt-1">
                    <RatingStars value={entry.rating ?? 5} size="xs" />
                    <p className="mt-1.5 text-sm font-semibold">{entry.name}</p>
                    <p className="text-muted-foreground text-xs">{entry.detail}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/** Closing call to action above the footer. */
export async function HomeCta() {
  const t = await getTranslations("home.cta");
  return (
    <Section>
      <Container>
        <div className="bg-brand/8 ring-brand/15 relative overflow-hidden rounded-2xl px-6 py-14 text-center ring-1 sm:px-12">
          <h2 className="font-display text-3xl font-semibold text-balance">{t("title")}</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-base text-pretty">
            {t("subtitle")}
          </p>
          <Button asChild size="lg" className="mt-7 h-11 px-6 text-base">
            <Link href="/books">{t("button")}</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}

export { BookShelf };
