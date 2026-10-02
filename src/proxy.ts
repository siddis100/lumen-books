import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/middleware";

/**
 * Combines two concerns for every storefront request:
 *  1. Supabase auth session refresh (keeps the cookie from expiring).
 *  2. Locale negotiation + `/` → `/en` redirect.
 *
 * `/api`, `/_next`, static files and files with an extension are excluded so
 * PayPal webhooks, Supabase callbacks and sitemap/robots can be served raw.
 */
const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const intlResponse = hasSupabaseConfig
    ? await refreshSession(request)
    : NextResponse.next({ request });

  // Run the intl middleware and copy the refreshed Supabase cookies onto its response.
  const localeResponse = intlMiddleware(request);
  for (const cookie of intlResponse.cookies.getAll()) {
    localeResponse.cookies.set(cookie);
  }

  return localeResponse;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals and files with an extension.
    "/((?!api|_next|_vercel|icon|favicon|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};