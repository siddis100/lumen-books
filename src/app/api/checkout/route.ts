import { NextResponse, type NextRequest } from "next/server";
import { checkoutPayloadSchema } from "@/lib/schemas";
import { rateLimit, clientIp, jsonError } from "@/lib/rate-limit";
import { createPayPalOrder } from "@/lib/paypal";
import { getSessionUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { CURRENCY } from "@/lib/money";
import {
  attachPayPalOrder,
  createPendingOrder,
  OrderError,
  priceOrder,
} from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checkout endpoint: turns a cart into a `pending` order plus a PayPal order.
 *
 * The browser never sends a price. Totals are recomputed server-side from the
 * `books` table (see `src/lib/orders.ts`), then handed to PayPal.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("checkout", ip, 12, 3600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = checkoutPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("invalid_payload", 422, {
      issues: parsed.error.issues.slice(0, 3).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { email, locale, items, promoCode } = parsed.data;

  try {
    const priced = await priceOrder(items, promoCode);

    // A code the shopper typed must not be silently dropped: it would be stored
    // on the order and the full subtotal charged. Fail loudly instead.
    //
    // The four refusals are reported separately. Telling someone their code is
    // invalid when it is simply too early, expired or used up is wrong, and it
    // is the shopper who ends up looking like the problem.
    if (promoCode && priced.promo.invalid) {
      const code = priced.promo.reason;
      if (code === "min_subtotal") throw new OrderError("promo_min_subtotal", promoCode);
      if (code === "expired" || code === "not_started") throw new OrderError("promo_expired", promoCode);
      throw new OrderError("promo_invalid", promoCode);
    }

    const user = await getSessionUser();
    const order = await createPendingOrder({
      email,
      locale,
      priced,
      userId: user?.id ?? null,
    });

    const base = siteUrl();
    const paypalOrder = await createPayPalOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: priced.lines.map((line) => ({
        name: `${line.title} — ${line.author}`,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
      })),
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      totalCents: priced.totalCents,
      returnUrl: `${base}/${locale}/checkout/success?order=${order.orderNumber}`,
      cancelUrl: `${base}/${locale}/checkout/cancelled`,
      customerEmail: user?.email ?? email,
      locale,
    });

    await attachPayPalOrder(order.id, paypalOrder.id);

    // PayPal returns the approval URL in `links`; the client redirects there.
    const approvalUrl =
      paypalOrder.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href ??
      null;

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paypalOrderId: paypalOrder.id,
      approvalUrl,
      totalCents: priced.totalCents,
      discountCents: priced.discountCents,
      currency: CURRENCY,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      // Every promo refusal is the client's own input, so 422 rather than 409:
      // the cart is not in a conflicting state, the code simply does not apply.
      const status = error.code.startsWith("promo_") ? 422 : 400;
      return jsonError(error.code, status);
    }
    console.error("[checkout] failed:", (error as Error).message);
    return jsonError("checkout_unavailable", 503);
  }
}
