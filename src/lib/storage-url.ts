/**
 * Helpers to build public URLs for files stored in Supabase Storage.
 *
 * Covers live in a public bucket, so a plain public URL is enough. PDF files
 * live in a private bucket and are NEVER built here — they are only reachable
 * through a short-lived signed URL issued by the server after a confirmed
 * PayPal payment (see `src/lib/supabase/admin.ts` and the download API route).
 */

const FALLBACK_COVER = "/images/cover-placeholder.svg";

/**
 * `cover_path` holds the key inside the public bucket (`covers/<slug>.<ext>`),
 * not a URL. Nothing serves that path from the site itself, so it has to be
 * expanded into the bucket's public endpoint.
 */
export function coverUrl(path: string | null | undefined): string {
  if (!path) return FALLBACK_COVER;
  if (/^https?:\/\//.test(path)) return path;

  const key = path.replace(/^\/+/, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return `/${key}`;
  return `${base}/storage/v1/object/public/${key}`;
}

export { FALLBACK_COVER };
