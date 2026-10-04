/**
 * Re-sends the order confirmation email for one order.
 *
 * Needed because `emailedAt` is a claim, not a delivery receipt: an order whose
 * send failed keeps a marker that looks identical to one that succeeded. The
 * webhook can no longer tell them apart, so this script exists for the operator
 * to re-issue a specific confirmation after Resend has been fixed.
 *
 * Dry run by default, and it only ever touches the order you name:
 *
 *   npx tsx --conditions=react-server scripts/retry-confirmation-email.ts
 *   npx tsx --conditions=react-server scripts/retry-confirmation-email.ts --order LB-261004-2193E6 --apply
 *
 * `--conditions=react-server` is required because `src/lib/db` imports
 * `server-only`, which throws outside a Next.js server context.
 *
 * It deliberately reuses `toConfirmationEmail`, so the message and the signed
 * download links are byte-for-byte what the webhook would have produced. Only
 * the sending side is replayed.
 */
import { readFileSync } from "node:fs";

import { and, isNotNull } from "drizzle-orm";

/**
 * The app modules read `process.env` at import time, so `.env.local` has to be
 * in place *before* the modules below are loaded.
 */
for (const file of [".env.local", ".env"]) {
  try {
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i).trim();
      if (process.env[key]) continue;
      process.env[key] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\\n/g, "\n");
    }
    break;
  } catch {
    /* .env.local absent: rely on the ambient environment */
  }
}

async function main() {
  const { db } = await import("@/lib/db");
  const { orders } = await import("@/lib/db/schema");
  const { findOrder, markOrderEmailed, releaseOrderEmail, toConfirmationEmail } = await import(
    "@/lib/orders"
  );
  const { sendOrderConfirmation } = await import("@/lib/email");

  const apply = process.argv.includes("--apply");
  const orderIndex = process.argv.indexOf("--order");
  const reference = orderIndex === -1 ? undefined : process.argv[orderIndex + 1];

  if (orderIndex !== -1 && !reference) {
    console.error("--order needs a value, e.g. --order LB-261004-2193E6");
    return 1;
  }

  /**
   * Candidates are the orders the webhook considers settled. A paid order with
   * no `webhookConfirmedAt` has no valid download links, so sending it would
   * only produce a mail that cannot work.
   */
  const settled = await db
    .select({
      orderNumber: orders.orderNumber,
      email: orders.email,
      locale: orders.locale,
      paidAt: orders.paidAt,
      webhookConfirmedAt: orders.webhookConfirmedAt,
      emailedAt: orders.emailedAt,
    })
    .from(orders)
    .where(and(isNotNull(orders.webhookConfirmedAt)))
    .orderBy(orders.createdAt);

  console.log(`\n${settled.length} webhook-confirmed order(s)\n`);
  for (const row of settled) {
    console.log(
      `${row.orderNumber}  ${row.email}  locale=${row.locale ?? "-"}  ${
        row.emailedAt ? "emailed" : "NOT emailed"
      }`,
    );
    console.log(
      `    paid=${row.paidAt?.toISOString() ?? "-"}  emailed=${row.emailedAt?.toISOString() ?? "-"}`,
    );
  }

  if (!reference) {
    console.log("\nNo --order given, so nothing was sent.");
    console.log(
      "Re-run with --order <NUMBER> --apply to re-issue one confirmation, picked from the list above.",
    );
    return 0;
  }

  const order = await findOrder(reference);
  if (!order) {
    console.error(`\nNo order matches ${reference}.`);
    return 1;
  }

  if (!order.webhookConfirmedAt) {
    console.error(
      `\n${order.orderNumber} is not webhook-confirmed, so its download links are not valid yet.`,
    );
    return 1;
  }

  // Same coercion as the webhook, so a re-send is not translated differently
  // from the message the customer was supposed to receive.
  const locale = order.locale === "fr" || order.locale === "ar" ? order.locale : "en";

  if (!apply) {
    console.log(
      `\nDry run: would re-send the confirmation for ${order.orderNumber} to ${order.email} (${locale}).`,
    );
    return 0;
  }

  /**
   * Drop the stale claim first: `markOrderEmailed` only succeeds on a row whose
   * `emailedAt` is null, which is exactly what makes it safe against a
   * concurrent webhook replay.
   */
  await releaseOrderEmail(order.id);

  const claimed = await markOrderEmailed(order.id);
  if (!claimed) {
    console.error(`\nAnother process claimed ${order.orderNumber} first; nothing sent.`);
    return 1;
  }

  const payload = await toConfirmationEmail(order, locale);
  const sent = await sendOrderConfirmation(payload);

  if (!sent) {
    await releaseOrderEmail(order.id);
    console.error(`\nSend failed for ${order.orderNumber}; the claim was released.`);
    console.error("Check RESEND_API_KEY, EMAIL_FROM and the domain verification status in Resend.");
    return 1;
  }

  console.log(`\nConfirmation accepted by Resend for ${order.orderNumber} -> ${order.email}`);
  console.log("Check the Resend dashboard for the delivery status before calling it done.");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
