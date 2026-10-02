"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/schemas";

/** Admin mutations for categories. Names are stored per locale, slug is the join key. */

export type CategoryActionResult =
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

const nullable = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

function toPayload(values: CategoryFormValues) {
  return {
    slug: values.slug,
    nameEn: values.nameEn.trim(),
    nameFr: nullable(values.nameFr),
    nameAr: nullable(values.nameAr),
    descriptionEn: nullable(values.descriptionEn),
    descriptionFr: nullable(values.descriptionFr),
    descriptionAr: nullable(values.descriptionAr),
    position: values.position,
    updatedAt: new Date(),
  };
}

export async function createCategoryAction(
  input: CategoryFormValues,
  locale: string,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.insert(categories).values(toPayload(parsed.data));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("categories_slug_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "slug_taken", fields: { slug: "This slug is already used" } };
    }
    console.error("[admin/categories] insert failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}

export async function updateCategoryAction(
  id: string,
  input: CategoryFormValues,
  locale: string,
): Promise<CategoryActionResult> {
  await requireAdmin();

  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };

  try {
    await db.update(categories).set(toPayload(parsed.data)).where(eq(categories.id, id));
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("categories_slug_idx") || message.includes("duplicate key")) {
      return { ok: false, error: "slug_taken", fields: { slug: "This slug is already used" } };
    }
    console.error("[admin/categories] update failed:", message);
    return { ok: false, error: "database" };
  }

  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}

/**
 * Deletes a category. `books.category_id` is ON DELETE SET NULL, so the books
 * survive and simply become uncategorised.
 */
export async function deleteCategoryAction(id: string, locale: string): Promise<CategoryActionResult> {
  await requireAdmin();

  await db.delete(categories).where(eq(categories.id, id));

  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}

/** Bulk reorder from the categories table drag handles. */
export async function reorderCategoriesAction(ids: string[], locale: string) {
  await requireAdmin();

  for (const [index, id] of ids.entries()) {
    await db
      .update(categories)
      .set({ position: index + 1, updatedAt: new Date() })
      .where(eq(categories.id, id));
  }

  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath(`/${locale}/books`);
  return { ok: true };
}