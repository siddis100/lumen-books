import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { rateLimit, clientIp, jsonError } from "@/lib/rate-limit";
import { subscribeToNewsletter } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.string().trim().max(40).optional(),
});

/**
 * Newsletter subscription. Validated, rate limited, idempotent (a duplicate
 * email is treated as success so we never leak who is already subscribed).
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("newsletter", ip, 8, 600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return jsonError("invalid_payload", 422);

  try {
    await db.insert(newsletterSubscribers).values(parsed.data).onConflictDoNothing();
  } catch (error) {
    // A missing database must not break the public page.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[newsletter] insert failed:", (error as Error).message);
    }
    return jsonError("newsletter_unavailable", 503);
  }

  // Confirmation email is best effort: never block the subscription on Resend.
  await subscribeToNewsletter(parsed.data.email).catch(() => undefined);

  return NextResponse.json({ ok: true }, { status: 201 });
}