import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase client authenticated with the service role key.
 *
 * RLS is bypassed, so this must ONLY ever be called from server code:
 * storage uploads/deletes, signed URLs and admin-only database work.
 */
export function createAdminClient(): SupabaseClient {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Storage buckets
 * ------------------------------------------------------------------ */

/** Cover art is served publicly and cacheable. */
export const COVERS_BUCKET = "covers";

/** Customer PDFs are private: reachable only through short-lived signed URLs. */
export const PDFS_BUCKET = "pdfs";

export function createSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  return createAdminClient()
    .storage.from(PDFS_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not create signed URL");
      return data.signedUrl;
    });
}