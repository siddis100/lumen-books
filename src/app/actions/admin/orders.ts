"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, type OrderStatus } from "@/lib/db/schema";

/**
 * Order reconciliation from the admin panel.
 *
 * IMPORTANT: this is an operational tool, not a payment shortcut. Marking an
 * order paid here never touches PayPal — it is for the rare cases where the
 * customer paid but the webhook never landed (PayPal outage, wrong webhook URL
 * configured, app redeployed mid-flight).
 */

const ALLOWED: OrderStatus[] = ["pending", "paid", "failed", "refunded", "cancelled"];

export type OrderActionResult =
  | { ok: true }
  | { ok: false; error: string };

function isStatus(value: string): value is OrderStatus {
  return (ALLOWED as string[]).includes(value);
}

export async function updateOrderStatusAction(
  id: string,
  status: string,
  locale: string,
): Promise<OrderActionResult> {
  await requireAdmin();
  if (!isStatus(status)) return { ok: false, error: "invalid_status" };

  const row = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const current = row[0];
  if (!current) return { ok: false, error: "not_found" };

  const patch: Partial<typeof orders.$inferInsert> = { status, updatedAt: new Date() };

  // Marking paid manually implies the money arrived: set the timestamps the
  // download route checks so the customer can actually fetch the file.
  if (status === "paid" && current.status !== "paid") {
    patch.paidAt = current.paidAt ?? new Date();
    patch.webhookConfirmedAt = current.webhookConfirmedAt ?? new Date();
    patch.paypalStatus = current.paypalStatus ?? "MANUAL";
  }

  await db.update(orders).set(patch).where(eq(orders.id, id));

  revalidatePath(`/${locale}/admin/orders`);
  revalidatePath(`/${locale}/admin/orders/${id}`);
  return { ok: true };
}

export async function updateOrderNoteAction(
  id: string,
  note: string,
  locale: string,
): Promise<OrderActionResult> {
  await requireAdmin();

  await db
    .update(orders)
    .set({ adminNote: note.trim().slice(0, 2000) || null, updatedAt: new Date() })
    .where(eq(orders.id, id));

  revalidatePath(`/${locale}/admin/orders/${id}`);
  return { ok: true };
}

/**
 * Re-queues the confirmation email for paid orders by clearing `emailed_at`.
 * The next (or replayed) PayPal webhook then sends a fresh message with brand
 * new guest download links — no state to rebuild by hand.
 */
export async function resendOrderEmailAction(
  ids: string[],
  locale: string,
): Promise<OrderActionResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "no_selection" };

  const rows = await db.select().from(orders).where(inArray(orders.id, ids));

  // Only ever touch confirmed orders: a customer must not receive download
  // links for an order whose payment was never verified.
  const eligible = rows.filter((row) => row.status === "paid" && row.webhookConfirmedAt !== null);
  if (eligible.length === 0) return { ok: false, error: "not_confirmed" };

  for (const row of eligible) {
    await db.update(orders).set({ emailedAt: null, updatedAt: new Date() }).where(eq(orders.id, row.id));
  }

  revalidatePath(`/${locale}/admin/orders`);
  return { ok: true };
}