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
 * `cover_path` holds the storage key inside the public `covers` bucket
 * (`covers/<slug>.<ext>`). It is served back through our own `/api/cover`
 * route instead of straight from Supabase's public-delivery endpoint, which
 * answers `404 Object not found` to browsers for objects it demonstrably has —
 * see the route's comment. The key goes in the path, not the query string,
 * because the CDN does not vary its cache on query parameters.
 */
export function coverUrl(path: string | null | undefined): string {
  if (!path) return FALLBACK_COVER;
  if (/^https?:\/\//.test(path)) return path;

  const key = path.replace(/^\/+/, "");
  return `/api/cover/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export { FALLBACK_COVER };
