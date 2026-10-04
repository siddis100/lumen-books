import { NextResponse, type NextRequest } from "next/server";

import { jsonError } from "@/lib/rate-limit";
import {
  listOrdersAwaitingEmail,
  markOrderEmailed,
  releaseOrderEmail,
  toConfirmationEmail,
} from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** At most this many orders per run, so one invocation cannot run for minutes. */
const BATCH = 25;

/**
 * Retries order confirmations that never left.
 *
 * The webhook is the only thing that mails a customer, and it runs once. When
 * Resend rejects the send — an expired key, an unverified sender, a provider
 * outage — `releaseOrderEmail` puts the order back in the queue, but nothing was
 * there to pick it up, and PayPal does not necessarily replay the event. A paid
 * customer would then own a book they can never download. This endpoint is that
 * missing pickup, scheduled from `netlify.toml`.
 *
 * `emailedAt IS NULL` on a webhook-confirmed order is the whole queue: it means
 * paid, confirmed, not delivered. Each order is claimed with the same conditional
 * UPDATE the webhook uses, so running this concurrently with a webhook replay can
 * never produce a duplicate email.
 *
 * Authenticated by `CRON_SECRET`, which Netlify sends as the `Authorization`
 * header on scheduled invocations. Safe to call by hand the same way.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/resend-confirmations] CRON_SECRET is not set; refusing to run");
    return jsonError("cron_disabled", 503);
  }

  const provided = request.headers.get("authorization");
  if (provided !== `Bearer ${secret}`) {
    return jsonError("unauthorized", 401);
  }

  const pending = await listOrdersAwaitingEmail(BATCH);
  const sent: string[] = [];
  const failed: string[] = [];

  for (const order of pending) {
    // The claim is what makes a retry safe: only one caller can flip it, so a
    // webhook replay racing this loop cannot double-send.
    if (!(await markOrderEmailed(order.id))) continue;

    const locale = order.locale === "fr" || order.locale === "ar" ? order.locale : "en";
    const delivered = await sendOrderConfirmation(await toConfirmationEmail(order, locale));

    if (delivered) {
      sent.push(order.orderNumber);
      continue;
    }

    // Hand the claim back so the next run tries again instead of the order
    // looking delivered when it never was.
    await releaseOrderEmail(order.id);
    failed.push(order.orderNumber);
    console.error(`[cron/resend-confirmations] send failed for ${order.orderNumber}`);
  }

  console.log(
    `[cron/resend-confirmations] ${pending.length} pending, ${sent.length} sent, ${failed.length} failed`,
  );

  // 200 even when a send failed: the cron succeeded, the email did not. A non-2xx
  // would only make Netlify report a failing schedule, and the rows stay queued
  // for the next run either way.
  return NextResponse.json({ ok: true, pending: pending.length, sent, failed });
}
