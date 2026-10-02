"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { profileSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile update.
 *
 * The display name is the only editable field: the email stays under Supabase
 * authentication and the role is never writable from the client.
 */
export async function updateProfileAction(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: "required" };

  const user = await requireUser();
  const { fullName, locale } = parsed.data;

  const supabase = await createClient();
  try {
    await db.update(profiles).set({ fullName, updatedAt: new Date() }).where(eq(profiles.id, user.id));
    // Mirror the change into the auth metadata so the header shows it too.
    await supabase.auth.updateUser({ data: { full_name: fullName } });
  } catch (error) {
    console.error("[profile] update failed:", (error as Error).message);
    return { error: "generic" };
  }

  revalidatePath(`/${locale}/account/profile`);
  revalidatePath(`/${locale}/account`, "layout");
  return { ok: true };
}
