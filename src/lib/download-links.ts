import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { downloadLinkSecret } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

/**
 * Signed guest download links.
 *
 * Guests never get an account, so their only access path is a link emailed with
 * the order confirmation. The link carries an HMAC over the order item id and
 * its expiry; the signature cannot be forged and expires on its own, so a leaked
 * inbox only stays valid for a bounded window.
 */

export type DownloadTokenPayload = {
  /** `orderItemId.expiresAt` */
  value: string;
  expiresAt: number;
};

/** Guest links stay valid long enough to survive a weekend, short enough to matter. */
export const GUEST_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

const SEPARATOR = ".";

function hmac(payload: string): string {
  const secret = downloadLinkSecret();
  if (!secret) {
    throw new Error(
      "DOWNLOAD_LINK_SECRET (or CRON_SECRET) must be set to email guest download links",
    );
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Builds a token for one order item, valid for `ttlSeconds`. */
export function createDownloadToken(orderItemId: string, ttlSeconds = GUEST_LINK_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const value = `${orderItemId}${SEPARATOR}${expiresAt}`;
  return `${value}${SEPARATOR}${hmac(value)}`;
}

/**
 * Verifies a token and returns the order item id it authorises, or `null` when
 * the token is malformed, forged or expired.
 */
export function verifyDownloadToken(
  token: string | null,
  orderItemId: string,
): { ok: true; expiresAt: number } | { ok: false } {
  if (!token) return { ok: false };

  const parts = token.split(SEPARATOR);
  if (parts.length !== 3) return { ok: false };

  const [id, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (id !== orderItemId) return { ok: false };
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) return { ok: false };

  const expected = hmac(`${id}${SEPARATOR}${expiresAtRaw}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  if (expiresAt * 1000 <= Date.now()) return { ok: false };

  return { ok: true, expiresAt };
}

/** Absolute, locale-independent URL to be embedded in the confirmation email. */
export function guestDownloadUrl(orderItemId: string, ttlSeconds = GUEST_LINK_TTL_SECONDS): string {
  const token = createDownloadToken(orderItemId, ttlSeconds);
  return `${siteUrl()}/api/downloads/${orderItemId}?token=${encodeURIComponent(token)}`;
}
