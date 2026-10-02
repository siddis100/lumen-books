"use server";

import { revalidatePath } from "next/cache";
import { and, eq, like, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { uploadPdf } from "@/lib/admin/storage";

/**
 * Bulk import of PDFs from a local folder.
 *
 * Each file becomes a DRAFT book (isActive = false) so nothing appears in the
 * storefront until an admin has filled in the description, price and cover.
 * The page-count and title shown in the preview are computed client-side; this
 * action re-reads the file and trusts only the bytes it receives.
 */

export type ImportRowResult = {
  name: string;
  ok: boolean;
  error?: "bad_type" | "too_large" | "empty" | "duplicate" | "storage" | "database";
  bookId?: string;
  slug?: string;
};

export type ImportResult = {
  imported: number;
  failed: number;
  rows: ImportRowResult[];
};

/** `Titre - Auteur.pdf` → title, author, slug. Falls back to the whole stem. */
function parseFileName(fileName: string): { title: string; author: string | null; slug: string } {
  const stem = fileName.replace(/\.pdf$/i, "").trim();
  const parts = stem.split(/\s+[—–-]\s+/);
  const title = (parts[0] ?? stem).trim();
  const author = parts.length > 1 ? (parts[1] ?? "").trim() : null;
  const slug =
    `${title}${author ? ` ${author}` : ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 180) || `book-${Date.now()}`;
  return { title, author: author || null, slug };
}

export async function importPdfsAction(formData: FormData, locale: string): Promise<ImportResult> {
  await requireAdmin();

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  const pagesRaw = String(formData.get("pages") ?? "[]");
  const titlesRaw = String(formData.get("titles") ?? "[]");

  let pageCounts: number[] = [];
  let titles: string[] = [];
  try {
    pageCounts = JSON.parse(pagesRaw) as number[];
    titles = JSON.parse(titlesRaw) as string[];
  } catch {
    // Preview metadata is optional; the import still works without it.
  }

  const rows: ImportRowResult[] = [];
  const usedSlugs = new Set<string>();

  for (const [index, file] of files.entries()) {
    const parsed = parseFileName(titles[index]?.trim() || file.name);

    // Two files mapping to the same slug in one batch would collide on the
    // unique index, so disambiguate before touching the database.
    let slug = parsed.slug;
    for (let suffix = 2; usedSlugs.has(slug); suffix += 1) {
      slug = `${parsed.slug}-${suffix}`;
    }
    usedSlugs.add(slug);

    const uploaded = await uploadPdf(file, slug);
    if (!uploaded.ok) {
      rows.push({ name: file.name, ok: false, error: uploaded.error });
      continue;
    }

    try {
      const inserted = await db
        .insert(books)
        .values({
          slug,
          title: parsed.title,
          author: parsed.author ?? "Unknown author",
          description: "Draft imported from a PDF. Complete the description before publishing.",
          priceCents: 0,
          compareAtCents: null,
          language: "en",
          formats: ["pdf"],
          pages: Number.isFinite(pageCounts[index]) && pageCounts[index] > 0 ? pageCounts[index] : null,
          coverPath: null,
          pdfPath: uploaded.path,
          pdfSizeBytes: uploaded.sizeBytes,
          pdfMimeType: uploaded.mimeType,
          // Drafts stay invisible until an admin publishes them.
          isActive: false,
          isFeatured: false,
          isDemo: false,
        })
        .returning({ id: books.id });

      const bookId = inserted[0]?.id;
      if (!bookId) {
        rows.push({ name: file.name, ok: false, error: "database" });
        continue;
      }
      rows.push({ name: file.name, ok: true, bookId, slug });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes("books_slug_idx") || message.includes("duplicate key")) {
        rows.push({ name: file.name, ok: false, error: "duplicate" });
      } else {
        console.error("[admin/import] insert failed:", message);
        rows.push({ name: file.name, ok: false, error: "database" });
      }
    }
  }

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/admin/import`);

  return {
    imported: rows.filter((row) => row.ok).length,
    failed: rows.filter((row) => !row.ok).length,
    rows,
  };
}

/** Placeholder copy written by the importer; a book must not ship with it. */
const DRAFT_PREFIX = "Draft imported";

/**
 * Publishes a draft, but refuses while it still carries importer placeholders
 * or a zero price — an incomplete listing must not reach the storefront.
 */
export async function publishBookAction(id: string, locale: string) {
  await requireAdmin();

  const row = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const book = row[0];
  if (!book) return { ok: false as const, error: "not_found" };
  if (book.priceCents <= 0) return { ok: false as const, error: "price_missing" };
  if (book.description.startsWith(DRAFT_PREFIX)) return { ok: false as const, error: "description_placeholder" };

  await db.update(books).set({ isActive: true, updatedAt: new Date() }).where(eq(books.id, id));

  revalidatePath(`/${locale}/admin/books`);
  revalidatePath(`/${locale}/books`);
  return { ok: true as const };
}

/** Lists the drafts left behind by the importer, so the admin can finish them. */
export async function listImportDrafts(locale: string) {
  await requireAdmin();

  return db
    .select({
      id: books.id,
      slug: books.slug,
      title: books.title,
      author: books.author,
      pdfSizeBytes: books.pdfSizeBytes,
      createdAt: books.createdAt,
    })
    .from(books)
    .where(and(like(books.description, `${DRAFT_PREFIX}%`), eq(books.isActive, false)))
    .orderBy(sql`${books.createdAt} desc`)
    .limit(100);
}