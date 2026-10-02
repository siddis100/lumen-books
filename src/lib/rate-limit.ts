import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";

/**
 * Fixed-window rate limiter stored in Postgres so the limit survives across
 * serverless instances (an in-memory counter would reset on every cold start).
 *
 * @param bucket  Logical limiter name, e.g. `"paypal:create-order"`.
 * @param id      Identifier to throttle, usually an IP address or email.
 * @param limit   Maximum number of calls allowed inside the window.
 * @param windowSeconds  Window length in seconds.
 */
export async function rateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number; retryAfter: number }> {
  const key = `${bucket}:${id}`;

  const [row] = await db
    .select()
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // No bucket yet, or the previous window has expired → start a fresh one.
  if (!row || now - row.windowStart.getTime() > windowMs) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: new Date(now) })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, windowStart: new Date(now) },
      });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (row.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - row.windowStart.getTime())) / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }

  await db
    .update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1` })
    .where(eq(rateLimits.key, key));

  return { ok: true, remaining: limit - row.count - 1, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers (Vercel, Cloudflare, generic). */
export function clientIp(request: Request): string {
  const headers = [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "cf-connecting-ip",
    "x-real-ip",
  ];
  for (const name of headers) {
    const value = request.headers.get(name);
    if (value) return value.split(",")[0]!.trim();
  }
  return "0.0.0.0";
}

/** Standard JSON error helper used by every route handler. */
export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}