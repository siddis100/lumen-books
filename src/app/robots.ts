import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces: never indexed, never cached as content.
        disallow: ["/api/", "/admin", "/account", "/checkout", "/cart"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}