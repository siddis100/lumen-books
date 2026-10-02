/**
 * Helpers to build public URLs for files stored in Supabase Storage.
 *
 * Covers live in a public bucket, so a plain public URL is enough. PDF files
 * live in a private bucket and are NEVER built here — they are only reachable
 * through a short-lived signed URL issued by the server after a confirmed
 * PayPal payment (see `src/lib/supabase/admin.ts` and the download API route).
 */

const FALLBACK_COVER = "/images/cover-placeholder.svg";

export function coverUrl(path: string | null | undefined): string {
  if (!path) return FALLBACK_COVER;
  if (/^https?:\/\//.test(path)) return path;
  return `/${path.replace(/^\/+/, "")}`;
}

export { FALLBACK_COVER };
