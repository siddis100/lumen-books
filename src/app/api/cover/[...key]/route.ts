import { createAdminClient, COVERS_BUCKET } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cover delivery, same-origin.
 *
 * The `covers` bucket is public, so `coverUrl()` could hand out a
 * `storage/v1/object/public/...` URL directly. It does not, because that
 * endpoint is unreliable for us: browsers get `404 Object not found` from
 * Supabase's delivery gateway while non-browser clients get a `200` out of
 * Cloudflare's cache — the object is there (`object/info` returns it, signed
 * URLs download it), only the public-delivery path lies. Chrome then turns the
 * JSON error into `net::ERR_BLOCKED_BY_ORB` and the cover never paints.
 *
 * So the bytes come through here instead: same origin, no ORB, no CORS, and a
 * CDN cacheable response on our own domain. The signed URL is short-lived and
 * never leaves the server.
 *
 * The storage key travels in the URL *path*, not the query string: Netlify's
 * CDN does not key its cache on query parameters, so `?path=a` and `?path=b`
 * would share one cache entry and every request would get whichever cover was
 * cached first.
 */

/** Only these extensions can be requested; a cover is never anything else. */
const ALLOWED_EXT = /\.(avif|gif|jpe?g|png|webp)$/i;

/** Enough for a redirect-free read, short enough to be useless if it leaks. */
const SIGNED_URL_TTL_SECONDS = 120;

const NOT_FOUND = () => new Response("Not found", { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  // `cover_path` is a storage key, never user input: reject anything that could
  // walk out of the bucket (`..`), address another bucket, or be a non-image.
  if (!key.startsWith(`${COVERS_BUCKET}/`) || key.includes("..") || !ALLOWED_EXT.test(key)) {
    return NOT_FOUND();
  }

  try {
    const signed = await createAdminClient()
      .storage.from(COVERS_BUCKET)
      .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);

    if (signed.error || !signed.data?.signedUrl) {
      console.error("[cover] signed url failed:", key, signed.error?.message);
      return NOT_FOUND();
    }

    const upstream = await fetch(signed.data.signedUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      console.error("[cover] upstream failed:", key, upstream.status);
      return NOT_FOUND();
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        // Cover keys embed the book slug, so a new upload is always a new URL:
        // nothing to revalidate, and the Netlify CDN serves repeat hits.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("[cover]", (error as Error).message);
    return NOT_FOUND();
  }
}