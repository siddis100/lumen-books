import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PKCE callback for Supabase auth.
 *
 * This route deliberately lives under `/api` (and not `/{locale}/auth/...`) so
 * the next-intl middleware does not rewrite it: Supabase redirects here with
 * `?code=...`, we exchange it for a session cookie, then bounce the visitor to
 * a locale-prefixed page.
 */

function localeFromNext(value: string | null): string {
  const match = value?.match(/^\/(en|fr|ar)(\/|$)/);
  return match ? match[1] : "en";
}

function homePath(locale: string) {
  return `/${locale}/account`;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const locale = localeFromNext(next);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(`/${locale}/auth/sign-in?error=generic`, url.origin));
  }

  if (!code) {
    // Recovery links land here without a code when the session is already known.
    if (next?.includes("reset-password")) {
      return NextResponse.redirect(new URL(`/${locale}/auth/reset-password`, url.origin));
    }
    return NextResponse.redirect(new URL(homePath(locale), url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth-callback] exchange failed:", error.message);
    return NextResponse.redirect(new URL(`/${locale}/auth/sign-in?error=invalidCredentials`, url.origin));
  }

  return NextResponse.redirect(new URL(next && next.startsWith("/") && !next.startsWith("//") ? next : homePath(locale), url.origin));
}
