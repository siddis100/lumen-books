import type { ImageLoaderProps } from "next/image";

/**
 * Image loader.
 *
 * Local assets (`/images/...`) keep going through the Next.js optimizer, which
 * works fine.
 *
 * Covers are a different case: they are already public objects sitting on the
 * Supabase CDN, which serves them with its own cache and its own resizing-free
 * delivery. Proxying them through `/_next/image` bought us nothing — the same
 * JPEG went out either way — but it made every cover depend on Netlify's image
 * pipeline, which intermittently answers `400` for exactly these URLs while
 * serving them fine to non-browser clients. Serving them directly removes that
 * dependency, and Supabase's CDN is a better cache for them than ours anyway.
 */
export default function lumenImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith("/")) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
  }
  return src;
}