import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

import { recordDownload } from "@/lib/account";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, orderItems, orders } from "@/lib/db/schema";
import { verifyDownloadToken } from "@/lib/download-links";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSignedUrl } from "@/lib/supabase/admin";

/**
 * Secure PDF download.
 *
 * Two authorisation paths:
 * - signed-in customers: `order.user_id` must match, or the order is a guest
 *   order (`user_id IS NULL`) whose email matches the session email, or the
 *   caller is an admin;
 * - guests: the emailed link carries an HMAC token (`?token=`) that expires.
 *
 * In every case the order must be paid AND webhook-confirmed, the book must be
 * active and have an uploaded file. Every failure returns 404 so the route
 * never reveals whether a given order item exists.
 */

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(request: Request, context: { params: Promise<{ orderItemId: string }> }) {
  const { orderItemId } = await context.params;
  if (!orderItemId) return notFound();

  const requestHeaders = await headers();
  const ip = clientIp(new Request("http://localhost", { headers: requestHeaders }));
  const limited = await rateLimit("download", `item:${orderItemId}:${ip}`, 30, 3600);
  if (!limited.ok) return notFound();

  let rows;
  try {
    rows = await db
      .select({
        orderItemId: orderItems.id,
        orderId: orders.id,
        orderUserId: orders.userId,
        orderEmail: orders.email,
        orderStatus: orders.status,
        webhookConfirmedAt: orders.webhookConfirmedAt,
        pdfPath: books.pdfPath,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(books, eq(orderItems.bookId, books.id))
      .where(and(eq(orderItems.id, orderItemId), eq(books.isActive, true)))
      .limit(1);
  } catch (error) {
    console.error("[downloads] lookup failed:", (error as Error).message);
    return notFound();
  }

  const row = rows[0];
  if (!row) return notFound();

  // The webhook is the only authority on payment.
  if (row.orderStatus !== "paid" || !row.webhookConfirmedAt) return notFound();
  if (!row.pdfPath) return notFound();

  const user = await getSessionUser();

  let authorized = false;
  if (user) {
    if (row.orderUserId) {
      authorized = row.orderUserId === user.id || user.isAdmin;
    } else {
      authorized =
        row.orderEmail.toLowerCase() === user.email.toLowerCase() || user.isAdmin;
    }
  }

  if (!authorized) {
    const token = new URL(request.url).searchParams.get("token");
    const verdict = verifyDownloadToken(token, orderItemId);
    // A token only unlocks a guest order: a logged-in customer whose link was
    // revoked by a refund must not be able to fall back on a stale email link.
    authorized = verdict.ok && !row.orderUserId;
  }

  if (!authorized) return notFound();

  try {
    const signedUrl = await createSignedUrl(row.pdfPath, SIGNED_URL_TTL_SECONDS);
    await recordDownload(row.orderItemId, user?.id ?? null, ip, requestHeaders.get("user-agent") ?? "");
    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (error) {
    console.error("[downloads] could not create signed URL:", (error as Error).message);
    return notFound();
  }
}
