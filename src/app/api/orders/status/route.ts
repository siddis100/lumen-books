import { NextResponse, type NextRequest } from "next/server";

import { routing, type Locale } from "@/i18n/routing";
import { findOrder, toConfirmationEmail } from "@/lib/orders";
import { clientIp, jsonError, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Narrow an untrusted `locale` query parameter to a supported language. */
function toLocale(value: string | null): Locale {
  return routing.locales.includes(value as Locale) ? (value as Locale) : routing.defaultLocale;
}

/**
 * Read-only order status used by the success page to poll for the webhook.
 *
 * Same authorisation rule as the capture route: the caller must present both
 * the human reference and the PayPal order id that PayPal put in the return
 * URL. Nothing else is exposed — no email, no customer data.
 *
 * Once the payment is confirmed the payload also carries `delivery`: the signed
 * download links, so the buyer is handed the files on the spot. The
 * confirmation email stays the durable copy, but it is no longer the only way
 * out for a guest — a provider outage, a spam folder or a paused deploy cannot
 * hold a paid order hostage. Those links carry exactly the same HMAC token as
 * the emailed ones, and are only ever issued for guest orders: a signed-in
 * customer is served by the library instead.
 */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("order-status", ip, 120, 3600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  const params = request.nextUrl.searchParams;
  const orderNumber = (params.get("order") ?? "").trim().toUpperCase();
  const paypalOrderId = (params.get("token") ?? "").trim();

  if (!orderNumber || !paypalOrderId) return jsonError("invalid_params", 400);

  const record = await findOrder(orderNumber);
  if (!record || record.paypalOrderId !== paypalOrderId) return jsonError("order_not_found", 404);

  const downloadsReady = record.status === "paid" && Boolean(record.webhookConfirmedAt);

  const body: {
    ok: true;
    status: string;
    orderNumber: string;
    totalCents: number;
    paidAt: Date | null;
    webhookConfirmed: boolean;
    downloadsReady: boolean;
    guestOrder: boolean;
    delivery?: Awaited<ReturnType<typeof toConfirmationEmail>>["items"];
  } = {
    ok: true,
    status: record.status,
    orderNumber: record.orderNumber,
    totalCents: record.totalCents,
    paidAt: record.paidAt,
    webhookConfirmed: Boolean(record.webhookConfirmedAt),
    downloadsReady,
    // Tells the page whether "my library" is even an option: a guest has no
    // account to open, so the page must never send them there.
    guestOrder: !record.userId,
  };

  if (downloadsReady && !record.userId) {
    try {
      body.delivery = (await toConfirmationEmail(record, toLocale(params.get("locale")))).items;
    } catch (error) {
      // A missing DOWNLOAD_LINK_SECRET must not turn a confirmed payment into a
      // 500: the order is paid and the customer can still be served by email.
      console.error("[order-status] could not sign download links:", (error as Error).message);
    }
  }

  return NextResponse.json(body);
}
