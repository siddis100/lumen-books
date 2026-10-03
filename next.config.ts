import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * next-intl plugin: points the server at our request config so `getTranslations`
 * and `<NextIntlClientProvider>` work during static rendering and in route
 * handlers.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** The one Supabase project we are allowed to talk to. */
const SUPABASE_HOST = "imkxxglvioxggzldylgh.supabase.co";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 *
 * `'unsafe-inline'` stays in `script-src` because Next.js ships the RSC payload
 * in inline `<script>` tags and threading a nonce through every layout would be
 * a much larger change. It still blocks any *external* script, which is what a
 * stored-XSS payload needs, and `object-src 'none'` removes the plugin vector.
 *
 * `'unsafe-eval'` and `upgrade-insecure-requests` are development-only: Turbopack
 * evaluates modules for HMR and `next dev` is served over plain HTTP.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${SUPABASE_HOST}`,
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}${isDev ? " ws: http:" : ""}`,
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Covers live in the public `covers` Supabase bucket.
    // Only the project's own project ref is allowed: a wildcard would let any
    // Supabase project proxy its images through our domain to track visitors.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imkxxglvioxggzldylgh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "imkxxglvioxggzldylgh.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // `/_next/image` answers `400` to browsers on this deployment while
    // serving the same URLs fine to non-browser clients, and the only local
    // asset is a 711-byte placeholder SVG that has nothing to optimise. Raw
    // sources are served by the platform CDN instead; covers come from
    // /api/cover (see src/app/api/cover/route.ts).
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 200, 256, 320],
  },

  // Only pin the headers we actually want; everything else is left to the
  // platform. Static assets are served by the CDN and never reach this server,
  // so `netlify.toml` repeats the caching rule for those paths.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // Cover images are content-addressed by name; keep them cached hard.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);