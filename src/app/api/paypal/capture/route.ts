import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, rateLimit, clientIp } from "@/lib/rate-limit";
import {
  capturedAmountCents,
  capturedId,
  capturePayPalOrder,
  isCaptureComplete,
} from "@/lib/paypal";
import { confirmOrderPayment, findOrder, OrderError } from "@/lib/orders";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Identity of the order being captured.
 *
 * The success page only knows what PayPal put in the URL: our human reference
 * (`LB-…`) and the PayPal order id (`token`). Both must match the row we
 * stored, which means a visitor cannot capture somebody else's order by
 * guessing a reference alone. Authenticated callers may pass `orderId`.
 */
const payloadSchema = z
  .object({
    orderNumber: z.string().trim().max(40).optional(),
    paypalOrderId: z.string().trim().max(40).optional(),
    orderId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.orderId ?? (value.orderNumber && value.paypalOrderId)), {
    message: "orderNumber + paypalOrderId (or orderId) is required",
  });

/**
 * Captures an approved PayPal order.
 *
 * The buyer comes back from PayPal to `/checkout/success`, which calls this
 * endpoint. Two independent things must agree before we treat the order as
 * paid: PayPal reports a `COMPLETED` capture **and** the captured amount equals
 * the total we stored. Downloads still stay locked until the signed webhook
 * confirms the event (see `confirmOrderPayment({ webhookConfirmed })`).
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = await rateLimit("paypal-capture", ip, 40, 3600);
  if (!limited.ok) return jsonError("rate_limited", 429, { retryAfter: limited.retryAfter });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) return jsonError("invalid_payload", 422);

  const { orderNumber, paypalOrderId, orderId } = parsed.data;

  const record = await findOrder(orderId ?? orderNumber!.toUpperCase());
  if (!record) return jsonError("order_not_found", 404);
  // The PayPal id in the URL must be the one we stored for this order.
  if (!orderId && record.paypalOrderId !== paypalOrderId) return jsonError("order_not_found", 404);
  if (!record.paypalOrderId) return jsonError("paypal_order_missing", 409);

  // Already settled: answer 200 so the success page can render.
  if (record.status === "paid" || record.status === "refunded") {
    return NextResponse.json({
      ok: true,
      status: record.status,
      orderNumber: record.orderNumber,
      totalCents: record.totalCents,
      webhookConfirmed: Boolean(record.webhookConfirmedAt),
    });
  }

  try {
    const captured = await capturePayPalOrder(record.paypalOrderId);

    if (!isCaptureComplete(captured)) {
      return jsonError("payment_not_completed", 409);
    }

    // Fail closed: an unreadable amount is treated as a mismatch, never a pass.
    const amount = capturedAmountCents(captured);
    if (amount === null || amount !== record.totalCents) {
      // Amount mismatch: never trust it, never deliver.
      await db
        .update(orders)
        .set({ status: "failed", paypalStatus: "AMOUNT_MISMATCH", updatedAt: new Date() })
        .where(eq(orders.id, record.id));
      console.error(
        `[paypal] amount mismatch on ${record.orderNumber}: captured ${amount ?? "unknown"} vs expected ${record.totalCents}`,
      );
      return jsonError("amount_mismatch", 409);
    }

    const result = await confirmOrderPayment({
      orderId: record.id,
      captureId: capturedId(captured),
      payerEmail: null,
      webhookConfirmed: false,
    });

    // No email here on purpose: the confirmation carries the download links,
    // and those must not exist before PayPal's signed webhook confirms the
    // payment. The webhook sends it instead.
    return NextResponse.json({
      ok: true,
      status: "paid",
      orderNumber: result.order.orderNumber,
      totalCents: result.order.totalCents,
      webhookConfirmed: Boolean(result.order.webhookConfirmedAt),
    });
  } catch (error) {
    if (error instanceof OrderError && error.code === "not_found") {
      return jsonError("order_not_found", 404);
    }
    console.error("[paypal] capture failed:", (error as Error).message);
    return jsonError("capture_unavailable", 502);
  }
}
