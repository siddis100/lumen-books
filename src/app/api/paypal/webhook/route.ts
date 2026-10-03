import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal";
import {
  confirmOrderPayment,
  findOrder,
  findOrderByPaypalId,
  markOrderEmailed,
  OrderError,
  toConfirmationEmail,
} from "@/lib/orders";
import { notifyNewOrder, sendOrderConfirmation } from "@/lib/email";
import type { Locale } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PayPal webhook receiver.
 *
 * This is the only path that unlocks downloads: the signature is verified with
 * PayPal's own endpoint (raw body + `PAYPAL-*` headers), and only a
 * `PAYMENT.CAPTURE.COMPLETED` event referencing an order we know can mark it
 * confirmed. Unknown orders, wrong currencies, amounts that do not match and
 * replayed events all end as `ignored`, which PayPal treats as a 200.
 */

type CaptureAmount = { currency_code?: string; value?: string };

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    reference_id?: string;
    invoice_id?: string;
    payer_email?: string;
    amount?: CaptureAmount;
    supplementary_data?: { related_ids?: { order_id?: string } };
    purchase_units?: {
      custom_id?: string;
      reference_id?: string;
      invoice_id?: string;
      amount?: CaptureAmount;
      payments?: {
        captures?: {
          id?: string;
          status?: string;
          amount?: CaptureAmount;
        }[];
      };
    }[];
  };
};

export async function POST(request: NextRequest) {
  // The signature covers the exact bytes PayPal sent, so no parsing before this.
  const rawBody = await request.text();

  let verified;
  try {
    verified = await verifyWebhookSignature(rawBody, request.headers);
  } catch (error) {
    console.error("[paypal-webhook] signature verification failed:", (error as Error).message);
    // 401 is the only honest answer: the event cannot be trusted.
    return new NextResponse("invalid signature", { status: 401 });
  }

  if (verified.verification_status !== "SUCCESS") {
    return new NextResponse("invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody) as WebhookEvent;

  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return NextResponse.json({ ok: true, handled: false, reason: "ignored_event" });
  }

  // PayPal documents `PAYMENT.CAPTURE.COMPLETED` with the capture itself as the
  // resource: `id`, `status` and `amount` sit at the top level and there is no
  // `purchase_units`. Alternate shapes nest the capture under the purchase unit,
  // so both are accepted, top level first.
  const unit = event.resource?.purchase_units?.[0];
  const nestedCapture = unit?.payments?.captures?.[0];
  const capture = event.resource?.id && event.resource?.amount ? event.resource : nestedCapture;

  // `custom_id` is not part of the documented capture payload, so the order
  // number and the PayPal order id are kept as fallbacks rather than relying on
  // it alone.
  const reference =
    event.resource?.custom_id ??
    unit?.custom_id ??
    event.resource?.reference_id ??
    unit?.reference_id ??
    event.resource?.invoice_id ??
    unit?.invoice_id;
  const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
  const origin = reference ?? paypalOrderId ?? "unknown";

  if (!capture?.id || (!reference && !paypalOrderId)) {
    return NextResponse.json({ ok: true, handled: false, reason: "missing_reference" });
  }
  if (capture.status !== "COMPLETED") {
    return NextResponse.json({ ok: true, handled: false, reason: "capture_not_completed" });
  }

  // Fail closed: a capture without a currency is not a USD capture.
  if (capture.amount?.currency_code !== "USD") {
    console.error(
      `[paypal-webhook] unexpected currency ${capture.amount?.currency_code ?? "missing"} on order ${origin}`,
    );
    return NextResponse.json({ ok: true, handled: false, reason: "currency_mismatch" });
  }

  try {
    const record =
      (reference ? await findOrder(reference) : null) ??
      (paypalOrderId ? await findOrderByPaypalId(paypalOrderId) : null);
    if (!record) return NextResponse.json({ ok: true, handled: false, reason: "unknown_order" });

    // Compare in cents to avoid float drift. A missing or unparsable amount is a
    // mismatch, never a pass.
    const expectedCents = record.totalCents;
    const capturedCents = Math.round(Number(capture.amount?.value) * 100);
    if (!Number.isFinite(capturedCents) || capturedCents !== expectedCents) {
      console.error(
        `[paypal-webhook] amount mismatch for ${record.orderNumber}: ${capturedCents} vs ${expectedCents}`,
      );
      return NextResponse.json({ ok: true, handled: false, reason: "amount_mismatch" });
    }

    const result = await confirmOrderPayment({
      orderId: record.id,
      captureId: capture.id,
      payerEmail: event.resource?.payer_email ?? null,
      webhookConfirmed: true,
    });

    // The confirmation carries the download links, so it can only be sent here —
    // never from the capture route, which may run before `webhookConfirmedAt`.
    // `markOrderEmailed` is a conditional UPDATE, so a replayed PayPal event
    // cannot mail the customer twice.
    if (result.changed) {
      const stored = record.locale;
      const locale: Locale = stored === "fr" || stored === "ar" ? stored : "en";
      const payload = await toConfirmationEmail(result.order, locale);
      if (await markOrderEmailed(record.id)) {
        await sendOrderConfirmation(payload);
        await notifyNewOrder(payload);
      }
    }

    return NextResponse.json({ ok: true, handled: true, orderNumber: result.order.orderNumber });
  } catch (error) {
    if (error instanceof OrderError && error.code === "not_found") {
      return NextResponse.json({ ok: true, handled: false, reason: "unknown_order" });
    }
    console.error("[paypal-webhook] handling failed:", (error as Error).message);
    // Ask PayPal to retry instead of silently dropping a paid order.
    return new NextResponse("retry", { status: 500 });
  }
}

/** PayPal pings this when the webhook is registered or re-registered. */
export async function GET() {
  return new NextResponse("paypal webhook endpoint", { status: 200 });
}
