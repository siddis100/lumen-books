"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { promoFormSchema, type PromoFormValues } from "@/lib/schemas";

/** Admin mutations for promo codes. */

export type PromoActionResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string> };

function fieldErrors(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const fields: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages?.[0]) fields[key] = messages[0];
  }
  return fields;
}

/** `datetime-local` inputs submit a naive string; assume UTC when parsing. */
function toDate(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPayload(values: PromoFormValues) {
  return {
    code: values.code.trim().toUpperCase(),
    kind: values.kind,
    value: values.value,
    minSubtotalCents: values.minSubtotalCents,
    maxUses: values.maxUses ?? null,
    startsAt: toDate(values.startsAt),
    expiresAt: toDate(values.expiresAt),
    isActive: values.isActive,
    updatedAt: new Date(),
  };
}

export async function createPromoAction(
  input: PromoFormValues,
  locale: string,
): Promise<PromoActionResult> {
  await requireAdmin();

  const parsed = promoFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.insert(promoCodes).values(toPayload(parsed.data));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("promo_codes_code_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "code_taken", fields: { code: "This code already exists" } };
    }
    console.error("[admin/promos] insert failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/promos`);
  return { ok: true };
}

export async function updatePromoAction(
  id: string,
  input: PromoFormValues,
  locale: string,
): Promise<PromoActionResult> {
  await requireAdmin();

  const parsed = promoFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.update(promoCodes).set(toPayload(parsed.data)).where(eq(promoCodes.id, id));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("promo_codes_code_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "code_taken", fields: { code: "This code already exists" } };
    }
    console.error("[admin/promos] update failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/promos`);
  return { ok: true };
}

export async function deletePromoAction(id: string, locale: string): Promise<PromoActionResult> {
  await requireAdmin();

  await db.delete(promoCodes).where(eq(promoCodes.id, id));

  revalidatePath(`/${locale}/admin/promos`);
  return { ok: true };
}

export async function togglePromoActiveAction(id: string, locale: string): Promise<PromoActionResult> {
  await requireAdmin();

  await db
    .update(promoCodes)
    .set({ isActive: sql`not ${promoCodes.isActive}`, updatedAt: new Date() })
    .where(eq(promoCodes.id, id));

  revalidatePath(`/${locale}/admin/promos`);
  return { ok: true };
}