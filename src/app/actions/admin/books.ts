"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, categories, orderItems } from "@/lib/db/schema";
import { bookFormSchema, type BookFormValues } from "@/lib/schemas";
import { uploadCover, uploadPdf, removeStoredFile } from "@/lib/admin/storage";

/**
 * Admin mutations for the catalogue.
 *
 * Every action starts with `requireAdmin()`, which throws FORBIDDEN when the
 * caller is not an admin — the throw propagates to the nearest `error.tsx`
 * boundary, so there is no way to reach a write without a session.
 */

export type AdminActionResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> };

function fieldErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages?.[0]) fields[key] = messages[0];
  }
  return fields;
}

/** Optional strings arrive as "" from the form and must become null in the DB. */
function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPayload(values: BookFormValues) {
  return {
    slug: values.slug,
    title: values.title.trim(),
    subtitle: nullable(values.subtitle),
    author: values.author.trim(),
    description: values.description.trim(),
    excerpt: nullable(values.excerpt),
    categoryId: nullable(values.categoryId) as string | null,
    priceCents: values.priceCents,
    compareAtCents: values.compareAtCents ?? null,
    language: values.language,
    formats: values.formats,
    pages: values.pages ?? null,
    isbn: nullable(values.isbn),
    publishedAt: nullable(values.publishedAt),
    isFeatured: values.isFeatured,
    isActive: values.isActive,
    isDemo: values.isDemo,
    updatedAt: new Date(),
  };
}

export async function createBookAction(
  input: BookFormValues,
  locale: string,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = bookFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.insert(books).values(toPayload(parsed.data));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("books_slug_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "slug_taken", fields: { slug: "This slug is already used" } };
    }
    console.error("[admin/books] insert failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}

export async function updateBookAction(
  id: string,
  input: BookFormValues,
  locale: string,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = bookFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.update(books).set(toPayload(parsed.data)).where(eq(books.id, id));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("books_slug_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "slug_taken", fields: { slug: "This slug is already used" } };
    }
    console.error("[admin/books] update failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/admin/books/${id}`);
  revalidatePath(`/${locale}/books/${parsed.data.slug}`);
  return { ok: true };
}

/** Uploads cover art and stores the returned path on the book row. */
export async function uploadBookCoverAction(id: string, formData: FormData, locale: string) {
  await requireAdmin();

  const file = formData.get("cover");
  const row = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!file || typeof file === "string" || !row[0]) return { ok: false as const, error: "missing_file" };

  const result = await uploadCover(file as File, row[0].slug);
  if (!result.ok) return result;

  const previous = row[0].coverPath;
  await db.update(books).set({ coverPath: result.path, updatedAt: new Date() }).where(eq(books.id, id));
  if (previous && previous !== result.path) {
    await removeStoredFile("covers", previous);
  }

  revalidatePath(`/${locale}/admin/books/${id}`);
  revalidatePath(`/${locale}/books/${row[0].slug}`);
  return { ok: true as const, path: result.path };
}

/** Uploads the customer PDF to the private bucket and records size + mime type. */
export async function uploadBookPdfAction(id: string, formData: FormData, locale: string) {
  await requireAdmin();

  const file = formData.get("pdf");
  const row = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!file || typeof file === "string" || !row[0]) return { ok: false as const, error: "missing_file" };

  const result = await uploadPdf(file as File, row[0].slug);
  if (!result.ok) return result;

  const previous = row[0].pdfPath;
  await db
    .update(books)
    .set({
      pdfPath: result.path,
      pdfSizeBytes: result.sizeBytes,
      pdfMimeType: result.mimeType,
      formats: row[0].formats.includes("pdf") ? row[0].formats : [...row[0].formats, "pdf"],
      updatedAt: new Date(),
    })
    .where(eq(books.id, id));

  if (previous && previous !== result.path) {
    await removeStoredFile("pdfs", previous);
  }

  revalidatePath(`/${locale}/admin/books/${id}`);
  return { ok: true as const, path: result.path };
}

/**
 * Hard-deletes a book. Refused when it appears in any order line: order items
 * reference `books` with ON DELETE RESTRICT so the historic invoices stay
 * readable. Such a book must be deactivated instead.
 */
export async function deleteBookAction(id: string, locale: string): Promise<AdminActionResult> {
  await requireAdmin();

  const sold = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.bookId, id))
    .limit(1);
  if (sold.length > 0) return { ok: false, error: "delete_blocked" };

  const row = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!row[0]) return { ok: false, error: "not_found" };

  await db.delete(books).where(eq(books.id, id));
  await removeStoredFile("covers", row[0].coverPath);
  await removeStoredFile("pdfs", row[0].pdfPath);

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/books`);
  redirect(`/${locale}/admin/books`);
}

/** Quick visibility toggle from the books table. */
export async function toggleBookActiveAction(id: string, locale: string): Promise<AdminActionResult> {
  await requireAdmin();

  await db
    .update(books)
    .set({ isActive: sql`not ${books.isActive}`, updatedAt: new Date() })
    .where(eq(books.id, id));

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}

/** Reassigns a book to another category (or to none). */
export async function moveBookCategoryAction(id: string, categoryId: string, locale: string) {
  await requireAdmin();

  const target = categoryId ? await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1) : [];
  await db
    .update(books)
    .set({ categoryId: target[0]?.id ?? null, updatedAt: new Date() })
    .where(eq(books.id, id));

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}