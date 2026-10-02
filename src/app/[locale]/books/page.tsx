import type { Metadata } from "next";
import { getTranslations, setRequestLocale, getFormatter } from "next-intl/server";
import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { Container, EmptyState } from "@/components/common/layout";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { BookCard } from "@/components/book/book-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocaleCategoryName, languageName } from "@/lib/i18n-helpers";
import { formatPrice } from "@/lib/money";
import {
  getAvailableLanguages,
  getCategories,
  getPriceBounds,
  queryCatalog,
  type CatalogSort,
} from "@/lib/queries/catalog";
import { routing, type Locale } from "@/i18n/routing";
import { headerMetadata } from "@/lib/seo";

/** Catalogue is revalidated every 5 minutes (ISR). */
export const revalidate = 300;

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return headerMetadata({ locale, title: t("metaTitle"), description: t("metaDescription"), path: "/books" });
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/** Maps the URL query string into a validated catalogue query. */
function parseQuery(params: Record<string, string | string[] | undefined>) {
  const sort = first(params.sort) as CatalogSort | undefined;
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  const min = Number.parseInt(first(params.minPrice) ?? "", 10);
  const max = Number.parseInt(first(params.maxPrice) ?? "", 10);
  return {
    q: first(params.q)?.slice(0, 80) || undefined,
    category: first(params.category) || undefined,
    language: first(params.language) || undefined,
    // URL carries whole dollars; the database stores cents.
    minPriceCents: Number.isFinite(min) ? Math.max(0, min) * 100 : undefined,
    maxPriceCents: Number.isFinite(max) ? Math.max(0, max) * 100 : undefined,
    sort: sort && ["relevance", "newest", "oldest", "bestselling", "price-asc", "price-desc", "rating"].includes(sort) ? sort : undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export default async function CataloguePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, rawSearchParams] = await Promise.all([getTranslations({ locale }), searchParams]);
  const query = parseQuery(rawSearchParams);

  const [categories, languages, priceBounds, result] = await Promise.all([
    getCategories(),
    getAvailableLanguages(),
    getPriceBounds(),
    queryCatalog(query),
  ]);

  const format = await getFormatter();
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.total);

  // Canonical, human-readable params reused by the filter sidebar and pagination.
  const flatParams = Object.fromEntries(
    Object.entries(rawSearchParams).map(([key, value]) => [key, first(value)]),
  );

  const filterCategories = categories.map((category) => ({
    slug: category.slug,
    name: getLocaleCategoryName(category, locale),
  }));

  const filterLanguages = languages.map((code) => ({
    code,
    label: languageName(code, locale),
  }));

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{t("catalog.title")}</h1>
        <p className="text-muted-foreground mt-3 text-sm sm:text-base">
          {t("catalog.subtitle", { count: result.total })}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
            <CatalogFilters
              categories={filterCategories}
              languages={filterLanguages}
              priceBounds={priceBounds}
            />
          </Suspense>
        </aside>

        <div>
          <div className="mb-6 flex flex-col gap-4">
            <Suspense fallback={<Skeleton className="h-11 w-full rounded-xl sm:max-w-md" />}>
              <CatalogSearch placeholder={t("catalog.searchPlaceholder")} />
            </Suspense>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {t("catalog.showing", { from, to, total: format.number(result.total) })}
            </p>
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-8" aria-hidden="true" />}
              title={t("catalog.noResults")}
              description={t("catalog.noResultsHint")}
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {result.items.map(({ book, categorySlug }) => {
                  const category = categories.find((entry) => entry.slug === categorySlug);
                  return (
                    <li key={book.id}>
                      <BookCard
                        book={book}
                        categoryName={category ? getLocaleCategoryName(category, locale) : undefined}
                      />
                    </li>
                  );
                })}
              </ul>

              <Suspense fallback={null}>
                <CatalogPagination
                  page={result.page}
                  pageCount={result.pageCount}
                  searchParams={flatParams}
                  labels={{ previous: t("catalog.previousPage"), next: t("catalog.nextPage") }}
                />
              </Suspense>
            </>
          )}

          {/* Screen-reader context for price range, e.g. "$4.99 – $29.99". */}
          <p className="sr-only">
            {t("catalog.priceRange")}: {formatPrice(priceBounds.minCents)} – {formatPrice(priceBounds.maxCents)}
          </p>
        </div>
      </div>
    </Container>
  );
}