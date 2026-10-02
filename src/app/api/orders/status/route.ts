import { NextResponse, type NextRequest } from "next/server";
import { clientIp, jsonError, rateLimit } from "@/lib/rate-limit";
import { findOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only order status used by the success page to poll for the webhook.
 *
 * Same authorisation rule as the capture route: the caller must present both
 * the human reference and the PayPal order id that PayPal put in the return
 * URL. Nothing else is exposed — no email, no items, no customer data.
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

  return NextResponse.json({
    ok: true,
    status: record.status,
    orderNumber: record.orderNumber,
    totalCents: record.totalCents,
    paidAt: record.paidAt,
    webhookConfirmed: Boolean(record.webhookConfirmedAt),
    downloadsReady: record.status === "paid" && Boolean(record.webhookConfirmedAt),
  });
}
