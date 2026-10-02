import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { adminEmails } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: "customer" | "admin";
  isAdmin: boolean;
};

/**
 * Resolves the current user together with their application profile.
 *
 * Two things can grant admin access:
 *  - `profiles.role = 'admin'` (set by a database trigger or by an existing admin)
 *  - the email appearing in `ADMIN_EMAILS`, which bootstraps the first admin
 *    without a manual database edit.
 *
 * Returns `null` for anonymous visitors, and never throws: the header, the
 * footer and the admin guard all rely on it being cheap and safe to call.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const email = (user.email ?? "").toLowerCase();
    const isAdminByEnv = adminEmails().includes(email);

    const [profile] = await db
      .select({ fullName: profiles.fullName, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    // Bootstrap: the first sign-in of an ADMIN_EMAIL promotes the profile row.
    if (profile && isAdminByEnv && profile.role !== "admin") {
      await db
        .update(profiles)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(profiles.id, user.id));
    }

    const role = profile?.role ?? "customer";
    const isAdmin = role === "admin" || isAdminByEnv;

    return {
      id: user.id,
      email,
      fullName: profile?.fullName ?? (user.user_metadata?.full_name as string | undefined) ?? null,
      role: isAdmin ? "admin" : "customer",
      isAdmin,
    };
  } catch {
    // Supabase not configured yet (fresh clone, CI without secrets).
    return null;
  }
}

/** Guard for Server Actions and admin pages. Throws to be caught by the caller. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

/** True when at least one admin account exists — drives the setup hint in the UI. */
export async function hasAnyAdmin(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(eq(profiles.role, "admin"));
    return (row?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
