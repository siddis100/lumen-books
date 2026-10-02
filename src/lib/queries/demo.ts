import "server-only";
import { cache } from "react";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";

/**
 * Helpers around the demo catalogue.
 *
 * Demo books are the placeholder titles shipped with the build so the shop can
 * be exercised end to end before the real PDFs are imported. They are flagged
 * with `books.is_demo = true` and are easy to list or purge at any time.
 */

export const getDemoBooks = cache(async () => {
  try {
    return await db.select().from(books).where(eq(books.isDemo, true)).orderBy(books.title);
  } catch {
    return [];
  }
});

export const hasAnyDemoBooks = cache(async () => {
  try {
    const [row] = await db
      .select({ value: count() })
      .from(books)
      .where(eq(books.isDemo, true));
    return (row?.value ?? 0) > 0;
  } catch {
    return false;
  }
});

export const countDemoBooks = cache(async () => {
  try {
    const [row] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(books)
      .where(eq(books.isDemo, true));
    return row?.value ?? 0;
  } catch {
    return 0;
  }
});
