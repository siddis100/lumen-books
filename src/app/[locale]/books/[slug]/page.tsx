import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, FileText, Hash, Languages, Package, ShieldCheck, Sparkles, Tag, Wifi } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/common/layout";
import { RatingStars } from "@/components/common/rating-stars";
import { BookCard } from "@/components/book/book-card";
import { AddToCart } from "@/components/book/add-to-cart";
import { ReviewForm } from "@/components/book/review-form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { getLocaleCategoryName, languageName } from "@/lib/i18n-helpers";
import { formatPrice } from "@/lib/money";
import { coverUrl } from "@/lib/storage-url";
import { jsonLd, localeUrl, localeAlternates, OG_LOCALE, absoluteUrl } from "@/lib/seo";
import {
  getAllBookSlugs,
  getApprovedReviews,
  getBookBySlug,
  getCategories,
  getSimilarBooks,
} from "@/lib/queries/catalog";
import { routing, type Locale } from "@/i18n/routing";

export const revalidate = 300;

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateStaticParams() {
  const rows = await getAllBookSlugs();
  return routing.locales.flatMap((locale) => rows.map((row) => ({ locale, slug: row.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const record = await getBookBySlug(slug);
  if (!record) return { title: "Not found", robots: { index: false, follow: false } };

  const t = await getTranslations({ locale, namespace: "book" });
  const description = t("metaDescriptionTemplate", {
    title: record.book.title,
    author: record.book.author,
    category: record.book.language.toUpperCase(),
    pages: record.book.pages ?? "—",
  });
  const url = localeUrl(locale, `/books/${slug}`);

  return {
    title: t("metaTitleTemplate", { title: record.book.title, author: record.book.author }),
    description,
    alternates: { canonical: url, languages: localeAlternates(`/books/${slug}`) },
    openGraph: {
      type: "book",
      title: record.book.title,
      description,
      url,
      locale: OG_LOCALE[locale],
      siteName: "Lumen Books",
      images: record.book.coverPath
        ? [{ url: coverUrl(record.book.coverPath), width: 800, height: 1200, alt: record.book.title }]
        : undefined,
    },
    twitter: { card: "summary_large_image", title: record.book.title, description },
  };
}

export default async function BookPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const record = await getBookBySlug(slug);
  if (!record) notFound();

  const { book, categorySlug } = record;
  const [t, format, categories, reviews, similar] = await Promise.all([
    getTranslations({ locale }),
    getFormatter(),
    getCategories(),
    getApprovedReviews(book.id),
    getSimilarBooks(book.id, book.categoryId),
  ]);
  const tb = await getTranslations({ locale, namespace: "book" });

  const category = categories.find((entry) => entry.slug === categorySlug) ?? null;
  const categoryName = category ? getLocaleCategoryName(category, locale) : null;
  const discount =
    book.compareAtCents && book.compareAtCents > book.priceCents
      ? Math.round((1 - book.priceCents / book.compareAtCents) * 100)
      : null;

  /* ---- structured data: Book + Product + Offer ---- */
  const structuredData = jsonLd([
    {
      "@type": "Book",
      "@id": `${localeUrl(locale, `/books/${slug}`)}#book`,
      name: book.title,
      alternateName: book.subtitle ?? undefined,
      author: { "@type": "Person", name: book.author },
      description: book.excerpt ?? book.description.slice(0, 500),
      inLanguage: book.language,
      isbn: book.isbn || undefined,
      numberOfPages: book.pages ?? undefined,
      datePublished: book.publishedAt ?? undefined,
      bookFormat: "https://schema.org/EBook",
      image: [absoluteUrl(coverUrl(book.coverPath))],
      aggregateRating:
        Number(book.ratingCount) > 0
          ? {
              "@type": "AggregateRating",
              ratingValue: Number(book.ratingAvg).toFixed(1),
              reviewCount: book.ratingCount,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
      review: reviews.slice(0, 3).map((review) => ({
        "@type": "Review",
        author: { "@type": "Person", name: review.authorName },
        reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
        reviewBody: review.body,
      })),
    },
    {
      "@type": "Product",
      "@id": `${localeUrl(locale, `/books/${slug}`)}#product`,
      name: book.title,
      description: book.excerpt ?? book.description.slice(0, 300),
      image: [absoluteUrl(coverUrl(book.coverPath))],
      sku: book.isbn || book.slug,
      brand: { "@type": "Brand", name: "Lumen Books" },
      category: categoryName ?? undefined,
      offers: {
        "@type": "Offer",
        url: localeUrl(locale, `/books/${slug}`),
        price: (book.priceCents / 100).toFixed(2),
        priceCurrency: "USD",
        availability: book.isActive ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "Lumen Books" },
      },
    },
  ]);

  const details: { icon: React.ReactNode; label: string; value: string }[] = [
    ...(book.isbn ? [{ icon: <Hash className="size-3.5" />, label: tb("detailIsbn"), value: book.isbn }] : []),
    ...(book.pages ? [{ icon: <FileText className="size-3.5" />, label: tb("detailPages"), value: format.number(book.pages) }] : []),
    ...(book.publishedAt
      ? [
          {
            icon: <CalendarDays className="size-3.5" />,
            label: tb("detailPublished"),
            value: format.dateTime(new Date(book.publishedAt), { year: "numeric", month: "long", day: "numeric" }),
          },
        ]
      : []),
    { icon: <Languages className="size-3.5" />, label: tb("detailLanguage"), value: languageName(book.language, locale) },
    { icon: <Package className="size-3.5" />, label: tb("detailFormat"), value: book.formats.map((f) => f.toUpperCase()).join(" + ") },
    ...(book.pdfSizeBytes
      ? [
          {
            icon: <FileText className="size-3.5" />,
            label: tb("detailFileSize"),
            value: `${(book.pdfSizeBytes / 1024 / 1024).toFixed(1)} MB`,
          },
        ]
      : []),
    ...(categoryName ? [{ icon: <Tag className="size-3.5" />, label: tb("detailCategory"), value: categoryName }] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <Container className="pt-6 pb-16">
        <nav aria-label={t("book.breadcrumb")} className="text-muted-foreground mb-6 flex flex-wrap items-center gap-1.5 text-xs">
          <Link href="/" className="hover:text-foreground transition-colors">
            {t("nav.home")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/books" className="hover:text-foreground transition-colors">
            {t("nav.books")}
          </Link>
          {category ? (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={{ pathname: "/books", query: { category: category.slug } }}
                className="hover:text-foreground transition-colors"
              >
                {getLocaleCategoryName(category, locale)}
              </Link>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span className="text-foreground line-clamp-1 font-medium">{book.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[22rem_1fr] lg:gap-14">
          {/* Cover */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="book-cover-frame relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-lg">
              <Image
                src={coverUrl(book.coverPath)}
                alt={`${book.title} — cover`}
                fill
                priority
                sizes="(min-width: 1024px) 22rem, 60vw"
                className="object-cover"
              />
            </div>
            <ul className="mt-5 flex flex-col gap-2 text-xs">
              <li className="text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="text-brand size-4" aria-hidden="true" />
                {tb("secureCheckout")}
              </li>
              <li className="text-muted-foreground flex items-center gap-2">
                <Wifi className="text-brand size-4" aria-hidden="true" />
                {tb("instantDownload")}
              </li>
              <li className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="text-brand size-4" aria-hidden="true" />
                {tb("lifetimeAccess")}
              </li>
            </ul>
          </div>

          {/* Details */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {category && categoryName ? (
                <Link href={{ pathname: "/books", query: { category: category.slug } }}>
                  <Badge variant="secondary" className="hover:bg-secondary/80">
                    {categoryName}
                  </Badge>
                </Link>
              ) : null}
              {book.isFeatured ? (
                <Badge className="bg-brand text-brand-foreground">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {tb("bestsellerBadge")}
                </Badge>
              ) : null}
              {book.isDemo ? <Badge variant="outline">{tb("demoBadge")}</Badge> : null}
            </div>

            <h1 className="font-display mt-3 text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              {book.title}
            </h1>
            {book.subtitle ? (
              <p className="text-muted-foreground mt-2 text-lg text-pretty">{book.subtitle}</p>
            ) : null}
            <p className="text-muted-foreground mt-2 text-base">
              {t("book.by")} <span className="text-foreground font-medium">{book.author}</span>
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {Number(book.ratingCount) > 0 ? (
                <a href="#reviews" className="hover:opacity-80 flex items-center gap-2">
                  <RatingStars value={Number(book.ratingAvg)} size="md" />
                  <span className="text-muted-foreground text-sm">
                    {format.number(Number(book.ratingAvg))} ·{" "}
                    {t("book.reviews")} ({format.number(book.ratingCount)})
                  </span>
                </a>
              ) : null}
            </div>

            {/* Buy box */}
            <div className="bg-card mt-6 rounded-2xl border p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl font-bold tabular-nums">{formatPrice(book.priceCents)}</span>
                {discount ? (
                  <>
                    <span className="text-muted-foreground text-base line-through tabular-nums">
                      {formatPrice(book.compareAtCents!)}
                    </span>
                    <Badge variant="destructive">-{discount}%</Badge>
                  </>
                ) : null}
                <span className="text-muted-foreground ms-auto text-xs">{t("common.currency")}</span>
              </div>

              <AddToCart
                book={{
                  id: book.id,
                  slug: book.slug,
                  title: book.title,
                  author: book.author,
                  priceCents: book.priceCents,
                  coverPath: book.coverPath,
                }}
                showQuantity
                size="lg"
                className="mt-4"
              />

              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{t("cart.digitalNotice")}</p>
            </div>

            {/* Description */}
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">{tb("aboutThisBook")}</h2>
              <div className="prose-lb mt-3 text-pretty">
                {book.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>

            {book.excerpt ? (
              <section className="mt-8">
                <h2 className="font-display text-xl font-semibold">{tb("excerpt")}</h2>
                <blockquote className="border-brand text-muted-foreground mt-3 border-s-2 ps-4 text-sm leading-relaxed italic">
                  {book.excerpt}
                </blockquote>
              </section>
            ) : null}

            {/* Specifications */}
            <section className="mt-8">
              <h2 className="font-display text-xl font-semibold">{tb("details")}</h2>
              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {details.map((detail) => (
                  <div key={detail.label} className="flex items-center justify-between gap-4 border-b pb-2 text-sm">
                    <dt className="text-muted-foreground flex items-center gap-2">
                      {detail.icon}
                      {detail.label}
                    </dt>
                    <dd className="font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Reviews */}
            <section id="reviews" className="mt-12 scroll-mt-24">
              <SectionHeading title={tb("reviews")} className="mb-4" />
              <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <div className="flex flex-col gap-4">
                  {reviews.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{tb("noReviews")}</p>
                  ) : (
                    reviews.map((review) => (
                      <article key={review.id} className="border-b pb-4 last:border-0">
                        <RatingStars value={review.rating} size="sm" />
                        {review.title ? <h3 className="mt-2 text-sm font-semibold">{review.title}</h3> : null}
                        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{review.body}</p>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {review.authorName} ·{" "}
                          {format.dateTime(new Date(review.createdAt), { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </article>
                    ))
                  )}
                </div>
                <ReviewForm
                  bookId={book.id}
                  names={{
                    title: tb("reviewTitle"),
                    rating: tb("reviewRating"),
                    body: tb("reviewBody"),
                    submit: tb("reviewSubmit"),
                    needsAuth: tb("reviewNeedsAuth"),
                    thanks: tb("reviewThanks"),
                  }}
                />
              </div>
            </section>
          </div>
        </div>
      </Container>

      {similar.length > 0 ? (
        <Section className="border-border/60 border-t">
          <Container>
            <SectionHeading title={tb("similarBooks")} />
            <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {similar.map((entry) => (
                <li key={entry.book.id}>
                  <BookCard
                    book={entry.book}
                    categoryName={
                      categories.find((c) => c.slug === entry.categorySlug)
                        ? getLocaleCategoryName(categories.find((c) => c.slug === entry.categorySlug)!, locale)
                        : null
                    }
                  />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}
    </>
  );
}