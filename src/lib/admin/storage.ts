import "server-only";

import { createAdminClient, COVERS_BUCKET, PDFS_BUCKET } from "@/lib/supabase/admin";

/**
 * Upload helpers for the admin panel.
 *
 * Covers land in the public `covers` bucket, customer PDFs in the private
 * `pdfs` bucket (only reachable through signed URLs issued after a confirmed
 * payment). Nothing here ever returns a public URL for a PDF.
 */

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

const COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Strips accents and punctuation so the file name is safe inside a bucket path. */
function safeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export type UploadResult =
  | { ok: true; path: string; sizeBytes: number; mimeType: string }
  | { ok: false; error: "too_large" | "bad_type" | "empty" | "storage" };

async function upload(
  bucket: string,
  path: string,
  file: File,
  maxBytes: number,
  contentType: string,
): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "empty" };
  if (file.size > maxBytes) return { ok: false, error: "too_large" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await createAdminClient()
    .storage.from(bucket)
    .upload(path, buffer, { contentType, upsert: true, cacheControl: "3600" });

  if (error) {
    console.error(`[storage] upload ${bucket}/${path} failed:`, error.message);
    return { ok: false, error: "storage" };
  }
  return { ok: true, path, sizeBytes: file.size, mimeType: contentType };
}

/** Uploads cover art to the public bucket. Returns the storage path only. */
export async function uploadCover(file: File, slug: string): Promise<UploadResult> {
  const extension = COVER_TYPES[file.type];
  if (!extension) return { ok: false, error: "bad_type" };
  return upload(COVERS_BUCKET, `covers/${safeName(slug)}.${extension}`, file, MAX_COVER_BYTES, file.type);
}

/**
 * Uploads a customer PDF to the private bucket. The path is stored on the book
 * row and only ever resolved into a short-lived signed URL at download time.
 */
export async function uploadPdf(file: File, slug: string): Promise<UploadResult> {
  if (file.type !== "application/pdf") return { ok: false, error: "bad_type" };
  return upload(PDFS_BUCKET, `pdfs/${safeName(slug)}.pdf`, file, MAX_PDF_BYTES, "application/pdf");
}

/** Removes a stored file. Failures are logged but never fatal for a DB write. */
export async function removeStoredFile(bucket: "covers" | "pdfs", path: string | null | undefined) {
  if (!path) return;
  const name = bucket === COVERS_BUCKET ? path.replace(/^covers\//, "") : path.replace(/^pdfs\//, "");
  const { error } = await createAdminClient().storage.from(bucket).remove([name]);
  if (error) console.warn(`[storage] remove ${bucket}/${name} failed:`, error.message);
}