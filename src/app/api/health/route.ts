import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the platform and for uptime monitoring.
 *
 * Only the verdict leaves the server: connection details stay in the logs so a
 * public endpoint cannot be used to fingerprint the database.
 *
 * It also reports whether the storefront is actually able to serve a guest, as
 * booleans and never as values. A store can be perfectly alive, take payment,
 * confirm the order through the webhook and still mail nothing, because the
 * sender is a placeholder or the webhook id is absent. Every one of those
 * failures is invisible from the outside and shows up only as a customer who
 * paid and received nothing, which is why they are checked here.
 *
 * The placeholder patterns mirror `scripts/check-env.mjs`; both answer the same
 * question from the two sides of the deploy.
 */

/**
 * Values copied from `.env.example` that look real enough to pass a presence
 * check. `^re_[x*]+$` cannot be expressed as `\bx{3,}\b` because `_` is a word
 * character, and `yourdomain` is a single word, so neither `\byour\b` matches it.
 */
const PLACEHOLDER = [
  /^re_[x*]+$/i,
  /yourdomain/i,
  /example\.(com|org|net)/i,
  /^xxx$/i,
  /\byour\b/i,
  /\bTODO\b/,
  /^changeme$/i,
];

const LOCAL_ORIGIN = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i;

function isFilled(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isReal(value: string | undefined): boolean {
  return isFilled(value) && !PLACEHOLDER.some((pattern) => pattern.test(value));
}

/** A sender must be an address, on a domain that is not a documentation stub. */
function isRealSender(value: string | undefined): boolean {
  return isReal(value) && (value as string).includes("@");
}

export async function GET() {
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    console.error("[health] database unreachable:", (error as Error).message);
    return Response.json({ status: "degraded" }, { status: 503 });
  }

  const emailSender = isRealSender(process.env.EMAIL_FROM);
  const emailApiKey = isReal(process.env.RESEND_API_KEY);
  const paypalWebhook = isFilled(process.env.PAYPAL_WEBHOOK_ID);
  const publicOrigin =
    isFilled(process.env.NEXT_PUBLIC_SITE_URL) &&
    !LOCAL_ORIGIN.test(process.env.NEXT_PUBLIC_SITE_URL.trim());

  return Response.json({
    status: "ok",
    config: { emailSender, emailApiKey, paypalWebhook, publicOrigin },
    /**
     * A guest has no account to fall back on: the confirmation email is their
     * only route to the file. This is the one boolean to alert on.
     */
    guestCheckoutReady: emailSender && emailApiKey && paypalWebhook && publicOrigin,
  });
}
