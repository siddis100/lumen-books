import "server-only";

import { z } from "zod";

/**
 * Centralised, validated access to environment variables.
 *
 * Server secrets are read lazily (so `next build` never fails on a missing key)
 * and are never bundled into the client — only the `NEXT_PUBLIC_*` values are.
 */

const serverSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PAYPAL_CLIENT_ID: z.string().min(10),
  PAYPAL_CLIENT_SECRET: z.string().min(10),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_WEBHOOK_ID: z.string().min(5).optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  EMAIL_FROM: z.string().default("Lumen Books <orders@lumenbooks.store>"),
  CONTACT_EMAIL: z.string().default("support@lumenbooks.store"),
  ADMIN_EMAILS: z.string().default(""),
  /** Shared HMAC secret protecting internal maintenance endpoints. */
  CRON_SECRET: z.string().min(8).optional(),
  /**
   * Secret signing guest download links. Falls back to `CRON_SECRET` when unset,
   * so a single value can protect both maintenance routes and order emails.
   */
  DOWNLOAD_LINK_SECRET: z.string().min(8).optional(),
});

/**
 * Public values are tolerant on purpose: the production build must succeed even
 * before the keys are injected (Vercel injects them at runtime), and the
 * storefront degrades to "empty but working" while the catalogue is offline.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().default(""),
  NEXT_PUBLIC_PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedServer: z.infer<typeof serverSchema> | null = null;
let cachedPublic: PublicEnv | null = null;

/** Throwing accessor for server-only configuration. */
export function env(): z.infer<typeof serverSchema> {
  if (!cachedServer) {
    const parsed = serverSchema.safeParse({
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
      PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
      PAYPAL_ENV: process.env.PAYPAL_ENV,
      PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      CONTACT_EMAIL: process.env.CONTACT_EMAIL,
      ADMIN_EMAILS: process.env.ADMIN_EMAILS,
      CRON_SECRET: process.env.CRON_SECRET,
      DOWNLOAD_LINK_SECRET: process.env.DOWNLOAD_LINK_SECRET,
    });
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid server environment variables — ${details}`);
    }
    cachedServer = parsed.data;
  }
  return cachedServer;
}

/** Non-throwing accessor for public configuration (safe in client components). */
export function publicEnv(): PublicEnv {
  if (!cachedPublic) {
    cachedPublic = publicSchema.parse({
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_PAYPAL_CLIENT_ID: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
      NEXT_PUBLIC_PAYPAL_ENV: process.env.NEXT_PUBLIC_PAYPAL_ENV,
    });
  }
  return cachedPublic;
}

/**
 * Emails listed here are always granted the admin role, which is how the first
 * administrator is bootstrapped without a manual database edit.
 */
export function adminEmails(): string[] {
  return env()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Absolute site origin, used for metadata, sitemaps and PayPal redirects. */
export function siteUrl(): string {
  return publicEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

/**
 * Support address rendered in the footer and on the contact page. Non-throwing
 * so static generation never depends on the mail configuration.
 */
export function contactEmail(): string {
  return process.env.CONTACT_EMAIL?.trim() || "support@lumenbooks.store";
}

/** True when Supabase credentials are present (auth + storage are usable). */
export function isSupabaseConfigured(): boolean {
  const p = publicEnv();
  return Boolean(p.NEXT_PUBLIC_SUPABASE_URL && p.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when PayPal Checkout can be rendered on the client. */
export function isPayPalConfigured(): boolean {
  return publicEnv().NEXT_PUBLIC_PAYPAL_CLIENT_ID.length > 0;
}

/**
 * HMAC key used to sign guest download links. `DOWNLOAD_LINK_SECRET` is
 * preferred; `CRON_SECRET` is accepted as a fallback so one value can protect
 * both maintenance routes and order emails.
 */
export function downloadLinkSecret(): string | null {
  const value = env().DOWNLOAD_LINK_SECRET ?? env().CRON_SECRET;
  return value && value.length >= 8 ? value : null;
}