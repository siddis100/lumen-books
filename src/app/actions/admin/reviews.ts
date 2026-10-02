"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, reviews, type ReviewStatus } from "@/lib/db/schema";

/** Moderation of customer reviews: approve, reject, or delete. */

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

export async function setReviewStatusAction(
  id: string,
  status: string,
  locale: string,
): Promise<ReviewActionResult> {
  await requireAdmin();
  if (!(STATUSES as string[]).includes(status)) return { ok: false, error: "invalid_status" };

  await db
    .update(reviews)
    .set({ status: status as ReviewStatus, updatedAt: new Date() })
    .where(eq(reviews.id, id));

  revalidatePath(`/${locale}/admin/reviews`);
  return { ok: true };
}

/**
 * Deletes a review and recomputes the book's aggregate rating so the storefront
 * never shows a rating derived from a review that no longer exists.
 */
export async function deleteReviewAction(id: string, locale: string): Promise<ReviewActionResult> {
  await requireAdmin();

  const row = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!row[0]) return { ok: false, error: "not_found" };

  await db.delete(reviews).where(eq(reviews.id, id));
  await recomputeBookRating(row[0].bookId);

  revalidatePath(`/${locale}/admin/reviews`);
  return { ok: true };
}

/** Recomputes `rating_avg` / `rating_count` from the approved reviews only. */
export async function recomputeBookRating(bookId: string) {
  await db
    .update(books)
    .set({
      ratingAvg: sql<number>`coalesce((
        select round(avg(rating)::numeric, 2) from ${reviews}
        where ${reviews.bookId} = ${bookId} and ${reviews.status} = 'approved'
      ), 0)`,
      ratingCount: sql<number>`(
        select count(*)::int from ${reviews}
        where ${reviews.bookId} = ${bookId} and ${reviews.status} = 'approved'
      )`,
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));
}

/** Bulk moderation from the pending queue. */
export async function moderateReviewsAction(
  ids: string[],
  status: string,
  locale: string,
): Promise<ReviewActionResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "no_selection" };
  if (!(STATUSES as string[]).includes(status)) return { ok: false, error: "invalid_status" };

  await db
    .update(reviews)
    .set({ status: status as ReviewStatus, updatedAt: new Date() })
    .where(sql`${reviews.id} in ${ids}`);

  revalidatePath(`/${locale}/admin/reviews`);
  return { ok: true };
}