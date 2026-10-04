import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { routing, type Locale } from "@/i18n/routing";
import { findOrder, toConfirmationEmail } from "@/lib/orders";
import { clientIp, jsonError, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-delivery of a guest order.
 *
 * The confirmation email is the durable copy of a purchase, but it is a
 * delivery channel like any other: it can be filtered, it can bounce, and it
 * depends on a sender domain that is not always ready on day one. This route is
 * the floor under it — a buyer who paid can always get the files back with the
 * two facts only they hold: the order reference from PayPal and the address the
 * payment was made with.
 *
 * Authorisation is therefore `order_number + email`, rate limited, and it only
 * ever mints the same HMAC download links the email carries. Signed-in orders
 * are refused: the library already serves them, indefinitely.
 */

const bodySchema = z.object({
  orderNumber: z.string().trim().min(8).max(40),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  locale: z.string().trim().max(5).optional(),
});

function toLocale(value: string | undefined): Locale {
  return routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale;
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("order-recover", ip, 10, 3600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return jsonError("invalid_params", 400);
  }

  const record = await findOrder(payload.orderNumber.trim().toUpperCase());
  // One answer for "no such order" and "wrong address": this route must not be
  // usable to find out who bought what.
  if (!record || record.email.toLowerCase() !== payload.email) {
    return jsonError("order_not_found", 404);
  }

  if (record.userId) return jsonError("use_account", 409);
  if (record.status !== "paid" || !record.webhookConfirmedAt) {
    return jsonError("order_not_paid", 409, { status: record.status });
  }

  let items: Awaited<ReturnType<typeof toConfirmationEmail>>["items"];
  try {
    items = (await toConfirmationEmail(record, toLocale(payload.locale))).items;
  } catch (error) {
    console.error("[order-recover] could not sign download links:", (error as Error).message);
    return jsonError("links_unavailable", 503);
  }

  return NextResponse.json({
    ok: true,
    orderNumber: record.orderNumber,
    email: record.email,
    totalCents: record.totalCents,
    paidAt: record.paidAt,
    items,
  });
}
