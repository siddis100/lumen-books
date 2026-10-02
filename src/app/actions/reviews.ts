"use server";

import { headers } from "next/headers";
import { reviewSchema } from "@/lib/schemas";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";

/**
 * Submits a review. Reviews land as `pending` and are published by an admin,
 * which keeps the storefront free of spam.
 */
export async function createReviewAction(input: {
  bookId: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<{ error?: string } | { ok: true }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };

  const requestHeaders = await headers();
  const ip = clientIp(new Request("http://localhost", { headers: requestHeaders }));

  // Only signed-in customers may review, so the rate limit can be stricter.
  const user = await getSessionUser();
  const limited = await rateLimit("review", user?.id ?? ip, 5, 3600);
  if (!limited.ok) return { error: "rate_limited" };

  if (!user) return { error: "unauthenticated" };

  try {
    await db.insert(reviews).values({
      bookId: parsed.data.bookId,
      userId: user.id,
      authorName: user.fullName?.trim() || user.email.split("@")[0],
      rating: parsed.data.rating,
      title: parsed.data.title?.trim() || null,
      body: parsed.data.body.trim(),
      status: "pending",
    });
    return { ok: true };
  } catch (error) {
    console.error("[reviews] insert failed:", (error as Error).message);
    return { error: "unavailable" };
  }
}