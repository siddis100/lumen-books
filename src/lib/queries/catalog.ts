import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { books, categories, profiles, reviews } from "@/lib/db/schema";

/**
 * Read-only query helpers used by the storefront.
 *
 * Every helper is wrapped in `safe()` so the site still renders (empty states)
 * when the database is not configured yet — for instance during the very first
 * `next build` on a fresh clone, before the Supabase project is linked.
 */

async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[queries] ${label} failed:`, (error as Error).message);
    }
    return fallback;
  }
}

export type CategoryRow = typeof categories.$inferSelect;
export type BookRow = typeof books.$inferSelect;

export const getCategories = cache(async (): Promise<CategoryRow[]> =>
  safe(
    "getCategories",
    async () =>
      db
        .select()
        .from(categories)
        .orderBy(asc(categories.position), asc(categories.nameEn)),
    [] as CategoryRow[],
  ),
);

export const getCategoryBySlug = cache(async (slug: string) =>
  safe("getCategoryBySlug", async () => {
    const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    return rows[0] ?? null;
  }, null),
);

export const getFeaturedBooks = cache(async (limit = 8) =>
  safe(
    "getFeaturedBooks",
    async () =>
      db
        .select({ book: books, categorySlug: categories.slug })
        .from(books)
        .leftJoin(categories, eq(books.categoryId, categories.id))
        .where(and(eq(books.isActive, true), eq(books.isFeatured, true)))
        .orderBy(desc(books.salesCount), desc(books.publishedAt))
        .limit(limit),
    [] as { book: BookRow; categorySlug: string | null }[],
  ),
);

export const getBestsellers = cache(async (limit = 8) =>
  safe(
    "getBestsellers",
    async () =>
      db
        .select({ book: books, categorySlug: categories.slug })
        .from(books)
        .leftJoin(categories, eq(books.categoryId, categories.id))
        .where(eq(books.isActive, true))
        .orderBy(desc(books.salesCount), desc(books.publishedAt))
        .limit(limit),
    [] as { book: BookRow; categorySlug: string | null }[],
  ),
);

export const getNewReleases = cache(async (limit = 8) =>
  safe(
    "getNewReleases",
    async () =>
      db
        .select({ book: books, categorySlug: categories.slug })
        .from(books)
        .leftJoin(categories, eq(books.categoryId, categories.id))
        .where(eq(books.isActive, true))
        .orderBy(desc(books.publishedAt), desc(books.createdAt))
        .limit(limit),
    [] as { book: BookRow; categorySlug: string | null }[],
  ),
);

export const getBookBySlug = cache(async (slug: string) =>
  safe("getBookBySlug", async () => {
    const rows = await db
      .select({ book: books, categorySlug: categories.slug })
      .from(books)
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .where(and(eq(books.slug, slug), eq(books.isActive, true)))
      .limit(1);
    return rows[0] ?? null;
  }, null),
);

export const getBookById = cache(async (id: string) =>
  safe("getBookById", async () => {
    const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
    return rows[0] ?? null;
  }, null),
);

/** Same category (or same author as a fallback), excluding the current book. */
export const getSimilarBooks = cache(async (bookId: string, categoryId: string | null, limit = 4) =>
  safe(
    "getSimilarBooks",
    async () =>
      db
        .select({ book: books, categorySlug: categories.slug })
        .from(books)
        .leftJoin(categories, eq(books.categoryId, categories.id))
        .where(
          and(
            eq(books.isActive, true),
            sql`${books.id} <> ${bookId}`,
            categoryId ? eq(books.categoryId, categoryId) : undefined,
          ),
        )
        .orderBy(desc(books.salesCount))
        .limit(limit),
    [] as { book: BookRow; categorySlug: string | null }[],
  ),
);

export const getApprovedReviews = cache(async (bookId: string, limit = 20) =>
  safe("getApprovedReviews", async () => db.select().from(reviews).where(and(eq(reviews.bookId, bookId), eq(reviews.status, "approved"))).orderBy(desc(reviews.createdAt)).limit(limit), []),
);

/** A few approved reviews from the whole catalogue, for the home page. */
export const getRecentReviews = cache(async (limit = 6) =>
  safe(
    "getRecentReviews",
    async () => {
      const rows = await db
        .select({
          id: reviews.id,
          bookId: reviews.bookId,
          bookSlug: books.slug,
          bookTitle: books.title,
          authorName: reviews.authorName,
          rating: reviews.rating,
          title: reviews.title,
          body: reviews.body,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .innerJoin(books, eq(reviews.bookId, books.id))
        .where(and(eq(reviews.status, "approved"), eq(books.isActive, true)))
        .orderBy(desc(reviews.createdAt))
        .limit(limit);
      return rows;
    },
    [],
  ),
);

/* ------------------------------------------------------------------ */
/* Catalogue search, filters, sorting, pagination                       */
/* ------------------------------------------------------------------ */

export type CatalogSort =
  | "relevance"
  | "newest"
  | "oldest"
  | "bestselling"
  | "price-asc"
  | "price-desc"
  | "rating";

export const CATALOG_PAGE_SIZE = 12;

export type CatalogQuery = {
  q?: string;
  category?: string;
  language?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: CatalogSort;
  page?: number;
  featured?: boolean;
};

export type CatalogResult = {
  items: { book: BookRow; categorySlug: string | null }[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function queryCatalog(query: CatalogQuery): Promise<CatalogResult> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = CATALOG_PAGE_SIZE;
  const sort: CatalogSort = query.sort ?? (query.q ? "relevance" : "newest");

  return safe(
    "queryCatalog",
    async () => {
      const where = [eq(books.isActive, true)];

      if (query.q) {
        const term = `%${query.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
        where.push(
          or(
            ilike(books.title, term),
            ilike(books.subtitle, term),
            ilike(books.author, term),
            ilike(books.isbn, term),
          )!,
        );
      }
      if (query.category) {
        where.push(sql`${books.categoryId} = (select id from ${categories} where ${categories.slug} = ${query.category})`);
      }
      if (query.language) {
        where.push(eq(books.language, query.language as BookRow["language"]));
      }
      if (typeof query.minPriceCents === "number") where.push(gte(books.priceCents, query.minPriceCents));
      if (typeof query.maxPriceCents === "number") where.push(lte(books.priceCents, query.maxPriceCents));
      if (query.featured) where.push(eq(books.isFeatured, true));

      const whereClause = and(...where);

      const orderBy: SQL[] = {
        relevance: [desc(books.isFeatured), desc(books.salesCount)],
        newest: [desc(books.publishedAt), desc(books.createdAt)],
        oldest: [asc(books.publishedAt)],
        bestselling: [desc(books.salesCount), desc(books.publishedAt)],
        "price-asc": [asc(books.priceCents)],
        "price-desc": [desc(books.priceCents)],
        rating: [desc(books.ratingAvg), desc(books.ratingCount)],
      }[sort];

      const [rows, totalRows] = await Promise.all([
        db
          .select({ book: books, categorySlug: categories.slug })
          .from(books)
          .leftJoin(categories, eq(books.categoryId, categories.id))
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(books).where(whereClause),
      ]);

      const total = totalRows[0]?.value ?? 0;

      return {
        items: rows,
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize)),
      };
    },
    { items: [], total: 0, page, pageSize, pageCount: 1 } as CatalogResult,
  );
}

/** Distinct languages present in the catalogue, for the language filter. */
export const getAvailableLanguages = cache(async () =>
  safe("getAvailableLanguages", async () => {
    const rows = await db
      .selectDistinct({ language: books.language })
      .from(books)
      .where(eq(books.isActive, true))
      .orderBy(asc(books.language));
    return rows.map((row) => row.language).filter(Boolean) as string[];
  }, [] as string[]),
);

/** Price bounds, to build a meaningful price range filter. */
export const getPriceBounds = cache(async () =>
  safe("getPriceBounds", async () => {
    const rows = await db
      .select({
        min: sql<number | null>`min(${books.priceCents})`,
        max: sql<number | null>`max(${books.priceCents})`,
      })
      .from(books)
      .where(eq(books.isActive, true));
    return {
      minCents: Number(rows[0]?.min ?? 0),
      maxCents: Number(rows[0]?.max ?? 5000),
    };
  }, { minCents: 0, maxCents: 5000 }),
);

/** Every published book, for the sitemap and for the incremental static params. */
export const getAllBookSlugs = cache(async () =>
  safe("getAllBookSlugs", async () => {
    const rows = await db
      .select({ slug: books.slug, updatedAt: books.updatedAt })
      .from(books)
      .where(eq(books.isActive, true));
    return rows;
  }, [] as { slug: string; updatedAt: Date }[]),
);

/** Lightweight search used by the header command palette. */
export const searchBooks = cache(async (term: string, limit = 6) =>
  safe(
    "searchBooks",
    async () => {
      const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      return db
        .select({
          id: books.id,
          slug: books.slug,
          title: books.title,
          author: books.author,
          priceCents: books.priceCents,
          coverPath: books.coverPath,
          ratingAvg: books.ratingAvg,
          ratingCount: books.ratingCount,
        })
        .from(books)
        .where(and(eq(books.isActive, true), or(ilike(books.title, like), ilike(books.author, like))!))
        .orderBy(desc(books.salesCount))
        .limit(limit);
    },
    [] as {
      id: string;
      slug: string;
      title: string;
      author: string;
      priceCents: number;
      coverPath: string | null;
      ratingAvg: string;
      ratingCount: number;
    }[],
  ),
);

/** Admin: all books including inactive ones, plus their category slug. */
export const getAdminBooks = cache(async () =>
  safe("getAdminBooks", async () => {
    return db
      .select({ book: books, categorySlug: categories.slug })
      .from(books)
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .orderBy(desc(books.createdAt));
  }, [] as { book: BookRow; categorySlug: string | null }[]),
);

/** Admin: profiles list, used to promote an account manually. */
export const getProfiles = cache(async () =>
  safe("getProfiles", async () => db.select().from(profiles).orderBy(asc(profiles.email)), []),
);
