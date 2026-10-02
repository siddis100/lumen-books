import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, downloads, orderItems, orders, profiles } from "@/lib/db/schema";

/**
 * Customer-account data.
 *
 * Every query is scoped to the authenticated user through Drizzle (service
 * role), because `orders` intentionally has no RLS policy for end users.
 *
 * Helpers are wrapped in `safe()` like the catalogue queries, so a page still
 * renders its empty state when `DATABASE_URL` is missing (first build, before
 * Supabase is linked) instead of crashing.
 */

async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[account] ${label} failed:`, (error as Error).message);
    }
    return fallback;
  }
}

export type AccountOrderItem = {
  id: string;
  bookId: string;
  title: string;
  author: string;
  coverPath: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Null when the file has not been uploaded yet. */
  pdfPath: string | null;
  pdfSizeBytes: number | null;
  slug: string | null;
};

export type AccountOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  promoCode: string | null;
  createdAt: Date;
  paidAt: Date | null;
  webhookConfirmedAt: Date | null;
  paypalCaptureId: string | null;
  items: AccountOrderItem[];
};

export type AccountStats = {
  orderCount: number;
  bookCount: number;
  spentCents: number;
};

export type AccountProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: Date;
};

/**
 * Guest orders carry `user_id = null`. When the same email later signs up, they
 * are attached to the account so the library appears without manual work.
 * The `user_id is null` guard makes replays harmless.
 */
export function claimGuestOrders(userId: string, email: string): Promise<number> {
  return safe(
    "claimGuestOrders",
    async () => {
      const result = await db
        .update(orders)
        .set({ userId, updatedAt: new Date() })
        .where(and(isNull(orders.userId), eq(orders.email, email)))
        .returning({ id: orders.id });
      return result.length;
    },
    0,
  );
}

export function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  return safe(
    "getAccountProfile",
    async () => {
      const rows = await db
        .select({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
          role: profiles.role,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      return rows[0] ?? null;
    },
    null,
  );
}

/** All orders of a user, newest first, with their items and current file state. */
export function getAccountOrders(userId: string, limit = 50): Promise<AccountOrder[]> {
  return safe(
    "getAccountOrders",
    async () => {
      const orderRows = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalCents: orders.totalCents,
          currency: orders.currency,
          promoCode: orders.promoCode,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
          webhookConfirmedAt: orders.webhookConfirmedAt,
          paypalCaptureId: orders.paypalCaptureId,
        })
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      if (orderRows.length === 0) return [];

      const itemRows = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          bookId: orderItems.bookId,
          title: orderItems.titleSnapshot,
          author: orderItems.authorSnapshot,
          coverPath: orderItems.coverPathSnapshot,
          unitPriceCents: orderItems.unitPriceCents,
          quantity: orderItems.quantity,
          lineTotalCents: orderItems.lineTotalCents,
          pdfPath: books.pdfPath,
          pdfSizeBytes: books.pdfSizeBytes,
          slug: books.slug,
        })
        .from(orderItems)
        .innerJoin(books, eq(orderItems.bookId, books.id))
        .where(inArray(orderItems.orderId, orderRows.map((o) => o.id)));

      const byOrder = new Map<string, AccountOrderItem[]>();
      for (const row of itemRows) {
        const list = byOrder.get(row.orderId) ?? [];
        list.push({
          id: row.id,
          bookId: row.bookId,
          title: row.title,
          author: row.author,
          coverPath: row.coverPath,
          unitPriceCents: row.unitPriceCents,
          quantity: row.quantity,
          lineTotalCents: row.lineTotalCents,
          pdfPath: row.pdfPath,
          pdfSizeBytes: row.pdfSizeBytes,
          slug: row.slug,
        });
        byOrder.set(row.orderId, list);
      }

      return orderRows.map((row) => ({ ...row, items: byOrder.get(row.id) ?? [] }));
    },
    [] as AccountOrder[],
  );
}

/**
 * The library: every distinct book from a paid AND webhook-confirmed order.
 * Pending orders are excluded on purpose — the webhook is the only authority.
 */
export type LibraryEntry = AccountOrderItem & {
  orderNumber: string;
  orderId: string;
  acquiredAt: Date;
};

export function getLibrary(userId: string): Promise<LibraryEntry[]> {
  return safe(
    "getLibrary",
    async () => {
      const paid = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          paidAt: orders.paidAt,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            eq(orders.status, "paid"),
            sql`${orders.webhookConfirmedAt} is not null`,
          ),
        )
        .orderBy(desc(orders.paidAt));

      if (paid.length === 0) return [];

      const rows = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          bookId: orderItems.bookId,
          title: orderItems.titleSnapshot,
          author: orderItems.authorSnapshot,
          coverPath: orderItems.coverPathSnapshot,
          unitPriceCents: orderItems.unitPriceCents,
          quantity: orderItems.quantity,
          lineTotalCents: orderItems.lineTotalCents,
          pdfPath: books.pdfPath,
          pdfSizeBytes: books.pdfSizeBytes,
          slug: books.slug,
        })
        .from(orderItems)
        .innerJoin(books, eq(orderItems.bookId, books.id))
        .where(inArray(orderItems.orderId, paid.map((o) => o.id)));

      const paidById = new Map(paid.map((o) => [o.id, o]));
      const seen = new Set<string>();
      const library: LibraryEntry[] = [];

      for (const row of rows) {
        if (seen.has(row.bookId)) continue;
        seen.add(row.bookId);
        const order = paidById.get(row.orderId);
        library.push({
          id: row.id,
          bookId: row.bookId,
          title: row.title,
          author: row.author,
          coverPath: row.coverPath,
          unitPriceCents: row.unitPriceCents,
          quantity: row.quantity,
          lineTotalCents: row.lineTotalCents,
          pdfPath: row.pdfPath,
          pdfSizeBytes: row.pdfSizeBytes,
          slug: row.slug,
          orderNumber: order?.orderNumber ?? "",
          orderId: row.orderId,
          acquiredAt: order?.paidAt ?? order?.createdAt ?? new Date(),
        });
      }

      return library;
    },
    [] as LibraryEntry[],
  );
}

/** Headline counters for the overview page. Refunded orders are not counted. */
export async function getAccountStats(userId: string): Promise<AccountStats> {
  return safe(
    "getAccountStats",
    async () => {
      const [summary] = await db
        .select({
          orderCount: sql<number>`count(*)::int`,
          spentCents: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
        })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.status, "paid")));

      const library = await getLibrary(userId);

      return {
        orderCount: Number(summary?.orderCount ?? 0),
        spentCents: Number(summary?.spentCents ?? 0),
        bookCount: library.length,
      };
    },
    { orderCount: 0, bookCount: 0, spentCents: 0 },
  );
}

/**
 * Records one download. Called by the download route itself, so the order item
 * id comes from the URL and the caller cannot spoof it.
 */
export async function recordDownload(
  orderItemId: string,
  userId: string | null,
  ip: string,
  userAgent: string,
): Promise<void> {
  try {
    await db.insert(downloads).values({
      orderItemId,
      userId,
      ip,
      userAgent: userAgent.slice(0, 500),
    });
  } catch (error) {
    // Auditing must never block the download itself.
    console.warn("[account] recordDownload failed:", (error as Error).message);
  }
}
