import "server-only";

import { and, desc, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  books,
  categories,
  contactMessages,
  newsletterSubscribers,
  orderItems,
  orders,
  profiles,
  promoCodes,
  reviews,
  type Book,
  type Category,
  type OrderStatus,
  type PromoCode,
  type Review,
  type ReviewStatus,
} from "@/lib/db/schema";

/**
 * Read-only queries for the admin panel.
 *
 * Like `src/lib/queries/catalog.ts`, every helper is wrapped in `safe()` so a
 * missing `DATABASE_URL` degrades the panel to empty tables instead of a 500
 * during `next build`. Writes live in `src/app/actions/admin/*` and are never
 * silently swallowed.
 */

async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[admin] ${label} failed:`, (error as Error).message);
    }
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type AdminBookRow = {
  book: Book;
  categorySlug: string | null;
  orderCount: number;
};

export type AdminOrderRow = {
  order: typeof orders.$inferSelect;
  items: number;
};

export type AdminReviewRow = {
  review: Review;
  bookTitle: string;
  bookSlug: string;
};

export type DashboardStats = {
  revenueCents: number;
  orderCount: number;
  paidCount: number;
  pendingCount: number;
  bookCount: number;
  demoCount: number;
  customerCount: number;
  avgOrderCents: number;
  reviewPendingCount: number;
};

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

const PAID = eq(orders.status, "paid" as OrderStatus);

export const getDashboardStats = async (): Promise<DashboardStats> =>
  safe(
    "getDashboardStats",
    async () => {
      const [money, statuses, catalogue, customers, pendingReviews] = await Promise.all([
        db
          .select({
            revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::bigint`,
            count: sql<number>`count(*)::int`,
          })
          .from(orders)
          .where(PAID),
        db
          .select({ status: orders.status, count: sql<number>`count(*)::int` })
          .from(orders)
          .groupBy(orders.status),
        db
          .select({
            total: sql<number>`count(*)::int`,
            demo: sql<number>`count(*) filter (where ${books.isDemo})::int`,
          })
          .from(books),
        db.select({ count: sql<number>`count(*)::int` }).from(profiles),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(reviews)
          .where(eq(reviews.status, "pending" as ReviewStatus)),
      ]);

      const paidCount = money[0]?.count ?? 0;
      const revenueCents = Number(money[0]?.revenue ?? 0);

      return {
        revenueCents,
        orderCount: statuses.reduce((total, row) => total + row.count, 0),
        paidCount,
        pendingCount: statuses.find((row) => row.status === "pending")?.count ?? 0,
        bookCount: catalogue[0]?.total ?? 0,
        demoCount: catalogue[0]?.demo ?? 0,
        customerCount: customers[0]?.count ?? 0,
        avgOrderCents: paidCount > 0 ? Math.round(revenueCents / paidCount) : 0,
        reviewPendingCount: pendingReviews[0]?.count ?? 0,
      };
    },
    {
      revenueCents: 0,
      orderCount: 0,
      paidCount: 0,
      pendingCount: 0,
      bookCount: 0,
      demoCount: 0,
      customerCount: 0,
      avgOrderCents: 0,
      reviewPendingCount: 0,
    } satisfies DashboardStats,
  );

/** One point per day for the last 30 days, oldest first — ready for a chart. */
export type SalesPoint = { date: string; cents: number; orders: number };

export const getSalesSeries = async (days = 30): Promise<SalesPoint[]> =>
  safe(
    "getSalesSeries",
    async () => {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - days);
      since.setUTCHours(0, 0, 0, 0);

      const rows = await db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${orders.paidAt}), 'YYYY-MM-DD')`,
          cents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::bigint`,
          orders: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(and(PAID, gte(orders.paidAt, since)))
        .groupBy(sql`date_trunc('day', ${orders.paidAt})`)
        .orderBy(sql`date_trunc('day', ${orders.paidAt})`);

      // Fill the gaps so the chart shows a continuous line rather than jumps.
      const byDate = new Map(rows.map((row) => [row.date, row]));
      const series: SalesPoint[] = [];
      for (let index = days - 1; index >= 0; index -= 1) {
        const day = new Date(since);
        day.setUTCDate(day.getUTCDate() + index);
        const key = day.toISOString().slice(0, 10);
        const row = byDate.get(key);
        series.push({ date: key, cents: Number(row?.cents ?? 0), orders: row?.orders ?? 0 });
      }
      return series;
    },
    [] as SalesPoint[],
  );

export const getTopBooks = async (limit = 5) =>
  safe(
    "getTopBooks",
    async () =>
      db
        .select({
          id: books.id,
          slug: books.slug,
          title: books.title,
          author: books.author,
          salesCount: books.salesCount,
          units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
          revenue: sql<number>`coalesce(sum(${orderItems.lineTotalCents}), 0)::bigint`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(books, eq(orderItems.bookId, books.id))
        .where(PAID)
        .groupBy(books.id)
        .orderBy(desc(sql`coalesce(sum(${orderItems.quantity}), 0)`))
        .limit(limit),
    [] as { id: string; slug: string; title: string; author: string; salesCount: number; units: number; revenue: number }[],
  );

export const getRecentOrders = async (limit = 8) =>
  safe(
    "getRecentOrders",
    async () =>
      db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(limit),
    [] as (typeof orders.$inferSelect)[],
  );

/* ------------------------------------------------------------------ *
 * Books
 * ------------------------------------------------------------------ */

/** Every book, published or not, with its order count (blocks hard deletes). */
export const getAdminBooks = async (): Promise<AdminBookRow[]> =>
  safe(
    "getAdminBooks",
    async () => {
      const rows = await db
        .select({ book: books, categorySlug: categories.slug })
        .from(books)
        .leftJoin(categories, eq(books.categoryId, categories.id))
        .orderBy(desc(books.createdAt));

      const sold = await db
        .select({ bookId: orderItems.bookId, count: sql<number>`count(*)::int` })
        .from(orderItems)
        .groupBy(orderItems.bookId);
      const soldByBook = new Map(sold.map((row) => [row.bookId, row.count]));

      return rows.map((row) => ({
        ...row,
        orderCount: soldByBook.get(row.book.id) ?? 0,
      }));
    },
    [] as AdminBookRow[],
  );

export const getAdminBook = async (id: string) =>
  safe(
    "getAdminBook",
    async () => {
      const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
      return rows[0] ?? null;
    },
    null,
  );

/** Title + author + slug of every book, used by the bulk importer. */
export const getBookIndex = async () =>
  safe(
    "getBookIndex",
    async () =>
      db
        .select({ id: books.id, title: books.title, author: books.author, slug: books.slug })
        .from(books),
    [] as { id: string; title: string; author: string; slug: string }[],
  );

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

export type AdminCategoryRow = Category & { bookCount: number };

export const getAdminCategories = async (): Promise<AdminCategoryRow[]> =>
  safe(
    "getAdminCategories",
    async () => {
      const rows = await db.select().from(categories).orderBy(categories.position, categories.nameEn);
      const counts = await db
        .select({ categoryId: books.categoryId, count: sql<number>`count(*)::int` })
        .from(books)
        .groupBy(books.categoryId);
      const byCategory = new Map(
        counts.map((row) => [row.categoryId, row.count] as const),
      );
      return rows.map((row) => ({ ...row, bookCount: byCategory.get(row.id) ?? 0 }));
    },
    [] as AdminCategoryRow[],
  );

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export const getAdminOrders = async (status?: OrderStatus): Promise<AdminOrderRow[]> =>
  safe(
    "getAdminOrders",
    async () => {
      const base = db
        .select({
          order: orders,
          items: sql<number>`(
            select count(*)::int from ${orderItems}
            where ${orderItems.orderId} = ${orders.id}
          )`,
        })
        .from(orders)
        .$dynamic();

      const rows = status
        ? await base.where(eq(orders.status, status)).orderBy(desc(orders.createdAt)).limit(200)
        : await base.orderBy(desc(orders.createdAt)).limit(200);

      return rows.map((row) => ({ ...row, items: Number(row.items) }));
    },
    [] as AdminOrderRow[],
  );

export const getAdminOrderDetail = async (id: string) =>
  safe(
    "getAdminOrderDetail",
    async () => {
      const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      if (!order) return null;
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(orderItems.createdAt);
      return { order, items };
    },
    null,
  );

/* ------------------------------------------------------------------ *
 * Promo codes & reviews
 * ------------------------------------------------------------------ */

export const getAdminPromos = async (): Promise<PromoCode[]> =>
  safe("getAdminPromos", async () => db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)), [] as PromoCode[]);

export const getAdminReviews = async (status?: ReviewStatus): Promise<AdminReviewRow[]> =>
  safe(
    "getAdminReviews",
    async () => {
      const rows = await db
        .select({ review: reviews, bookTitle: books.title, bookSlug: books.slug })
        .from(reviews)
        .innerJoin(books, eq(reviews.bookId, books.id))
        .$dynamic()
        .orderBy(desc(reviews.createdAt))
        .limit(200);

      return status ? rows.filter((row) => row.review.status === status) : rows;
    },
    [] as AdminReviewRow[],
  );

/* ------------------------------------------------------------------ *
 * Misc counters
 * ------------------------------------------------------------------ */

export const getSubscriberCount = async () =>
  safe(
    "getSubscriberCount",
    async () => {
      const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(newsletterSubscribers);
      return row?.value ?? 0;
    },
    0,
  );

export const getUnreadContactCount = async () =>
  safe(
    "getUnreadContactCount",
    async () => {
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(contactMessages)
        .where(eq(contactMessages.handled, false));
      return row?.value ?? 0;
    },
    0,
  );

export const getTotals = async () =>
  safe(
    "getTotals",
    async () => {
      const rows = await db
        .select({
          subtotal: sum(orders.subtotalCents),
          discount: sum(orders.discountCents),
        })
        .from(orders)
        .where(PAID);
      return {
        subtotalCents: Number(rows[0]?.subtotal ?? 0),
        discountCents: Number(rows[0]?.discount ?? 0),
      };
    },
    { subtotalCents: 0, discountCents: 0 },
  );