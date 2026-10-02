import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, jsonError, rateLimit } from "@/lib/rate-limit";
import { OrderError, priceOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  items: z
    .array(
      z.object({
        bookId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(20),
  promoCode: z.string().trim().max(40).optional(),
});

/**
 * Authoritative cart pricing.
 *
 * The cart page calls this so the subtotal and the promo discount shown to the
 * customer come from the database, not from localStorage. An invalid promo code
 * is reported as `promoValid: false` rather than an error, so the cart can keep
 * rendering a normal total.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("cart-price", ip, 60, 60);
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
    const priced = await priceOrder(parsed.data.items, parsed.data.promoCode);
    return NextResponse.json({
      ok: true,
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      totalCents: priced.totalCents,
      promoCode: priced.promo.code,
      promoValid: priced.promo.code === null || !priced.promo.invalid,
      /** Present only when the code is genuine but the basket is too small. */
      promoMinSubtotalCents: priced.promo.minSubtotalCents ?? null,
      lines: priced.lines.map((line) => ({
        bookId: line.bookId,
        title: line.title,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
      })),
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return jsonError(error.code, error.code === "empty_cart" ? 400 : 409);
    }
    console.error("[cart-price] failed:", (error as Error).message);
    return jsonError("pricing_unavailable", 503);
  }
}
