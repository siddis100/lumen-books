import { NextResponse, type NextRequest } from "next/server";
import { searchBooks } from "@/lib/queries/catalog";
import { rateLimit, clientIp, jsonError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight title/author search used by the header command palette.
 * Rate limited to keep the endpoint from being abused as a crawler.
 */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("search", ip, 60, 60);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  const term = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (term.length < 2) return NextResponse.json({ results: [] });

  const rows = await searchBooks(term, 6);
  return NextResponse.json(
    {
      results: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        author: row.author,
        priceCents: row.priceCents,
        coverPath: row.coverPath,
        ratingAvg: row.ratingAvg,
        ratingCount: row.ratingCount,
      })),
    },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=120" } },
  );
}