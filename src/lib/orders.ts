import "server-only";

import { and, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { books, orderItems, orders, promoCodes } from "@/lib/db/schema";
import { applyPercentDiscount, CURRENCY } from "@/lib/money";
import { guestDownloadUrl } from "@/lib/download-links";
import type { EmailOrder } from "@/lib/email";
import type { Locale } from "@/i18n/routing";

/**
 * Order pipeline.
 *
 * Security model: the browser only ever sends `{ bookId, quantity }` plus an
 * optional promo code. Prices, titles and totals are recomputed here from the
 * `books` table, so a tampered cart (or a replayed request) can never change
 * what PayPal is asked to charge.
 *
 * Downloads stay locked until `confirmOrderPayment()` runs, and that function
 * is only reachable from the capture route or from a verified PayPal webhook.
 */

export type CheckoutItemInput = { bookId: string; quantity: number };

export const MAX_ITEM_QUANTITY = 10;
export const MAX_DISTINCT_ITEMS = 20;

export type PricedLine = {
  bookId: string;
  title: string;
  author: string;
  coverPath: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type PromoResult = {
  code: string | null;
  discountCents: number;
  kind: "percent" | "fixed";
  invalid: boolean;
  /**
   * Set when the code itself is fine but the basket is too small. Without this
   * the caller cannot tell "this code does not exist" from "add $4.10 more",
   * and shows the customer a false accusation about their own code.
   */
  minSubtotalCents?: number;
  /**
   * Why an otherwise well-formed code was refused. `invalid: true` alone is
   * too coarse: four different situations collapse into one flag, and the
   * checkout then blames the shopper for a code that never existed.
   */
  reason?: "unknown" | "not_started" | "expired" | "exhausted" | "min_subtotal";
};

export type PricedOrder = {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: typeof CURRENCY;
  promo: PromoResult;
};

export class OrderError extends Error {
  constructor(
    readonly code:
      | "empty_cart"
      | "too_many_items"
      | "book_not_found"
      | "book_unavailable"
      | "book_no_file"
      | "invalid_quantity"
      | "promo_invalid"
      | "promo_expired"
      | "promo_min_subtotal"
      | "not_found",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "OrderError";
  }
}

/** Normalises the raw payload: integers, sane caps, de-duplicated. */
export function normalizeItems(input: CheckoutItemInput[]): CheckoutItemInput[] {
  const byBook = new Map<string, number>();

  for (const raw of input) {
    const bookId = String(raw?.bookId ?? "").trim();
    const quantity = Math.floor(Number(raw?.quantity ?? 1));
    if (!bookId || !Number.isFinite(quantity)) continue;
    if (quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      throw new OrderError("invalid_quantity", `${bookId}: quantity must be 1–${MAX_ITEM_QUANTITY}`);
    }
    byBook.set(bookId, Math.min((byBook.get(bookId) ?? 0) + quantity, MAX_ITEM_QUANTITY));
    if (byBook.size > MAX_DISTINCT_ITEMS) {
      throw new OrderError("too_many_items", `At most ${MAX_DISTINCT_ITEMS} different titles per order.`);
    }
  }

  return [...byBook.entries()].map(([bookId, quantity]) => ({ bookId, quantity }));
}

/** Applies a promo code to a subtotal. Returns `invalid: true` instead of throwing. */
export async function pricePromo(code: string | undefined, subtotalCents: number): Promise<PromoResult> {
  const empty: PromoResult = { code: null, discountCents: 0, kind: "percent", invalid: false };
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return empty;

  const rows = await db
    .select()
    .from(promoCodes)
    .where(and(eq(promoCodes.code, normalized), eq(promoCodes.isActive, true)))
    .limit(1);
  const promo = rows[0];
  if (!promo) return { ...empty, code: normalized, invalid: true, reason: "unknown" };

  const now = Date.now();
  if (promo.startsAt && promo.startsAt.getTime() > now) {
    return { code: normalized, discountCents: 0, kind: promo.kind, invalid: true, reason: "not_started" };
  }
  if (promo.expiresAt && promo.expiresAt.getTime() < now) {
    return { code: normalized, discountCents: 0, kind: promo.kind, invalid: true, reason: "expired" };
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { code: normalized, discountCents: 0, kind: promo.kind, invalid: true, reason: "exhausted" };
  }
  if (promo.minSubtotalCents > subtotalCents) {
    return {
      code: normalized,
      discountCents: 0,
      kind: promo.kind,
      invalid: true,
      reason: "min_subtotal",
      minSubtotalCents: promo.minSubtotalCents,
    };
  }

  const discountCents =
    promo.kind === "percent"
      ? applyPercentDiscount(subtotalCents, promo.value)
      : Math.min(promo.value, subtotalCents);

  return { code: normalized, discountCents, kind: promo.kind, invalid: false };
}

/**
 * Re-reads the catalogue and returns authoritative lines and totals.
 * Throws `OrderError` when the cart cannot be honoured as sent.
 */
export async function priceOrder(
  items: CheckoutItemInput[],
  promoCode?: string,
): Promise<PricedOrder> {
  const normalized = normalizeItems(items);
  if (normalized.length === 0) throw new OrderError("empty_cart");

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      coverPath: books.coverPath,
      priceCents: books.priceCents,
      isActive: books.isActive,
      pdfPath: books.pdfPath,
    })
    .from(books)
    .where(inArray(books.id, normalized.map((item) => item.bookId)));

  if (rows.length === 0) throw new OrderError("book_not_found");

  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines: PricedLine[] = [];

  for (const item of normalized) {
    const book = byId.get(item.bookId);
    if (!book) throw new OrderError("book_not_found");
    if (!book.isActive) throw new OrderError("book_unavailable", book.title);
    // A title with no file behind it must never be charged for. Drafts and
    // imported-but-unpublished titles stay browsable, just not sellable.
    if (!book.pdfPath) throw new OrderError("book_no_file", book.title);
    lines.push({
      bookId: book.id,
      title: book.title,
      author: book.author,
      coverPath: book.coverPath,
      unitPriceCents: book.priceCents,
      quantity: item.quantity,
      lineTotalCents: book.priceCents * item.quantity,
    });
  }

  const subtotalCents = lines.reduce((total, line) => total + line.lineTotalCents, 0);
  const promo = await pricePromo(promoCode, subtotalCents);
  const totalCents = Math.max(0, subtotalCents - promo.discountCents);

  return { lines, subtotalCents, discountCents: promo.discountCents, totalCents, currency: CURRENCY, promo };
}

/** Human-readable reference: `LB-20260215-8F3K2A`. */
export function newOrderNumber(now = new Date()): string {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `LB-${stamp}-${random}`;
}

export type CreateOrderInput = {
  email: string;
  userId?: string | null;
  locale: string;
  priced: PricedOrder;
};

/** Inserts a `pending` order plus its line items inside one transaction. */
export async function createPendingOrder(input: CreateOrderInput) {
  const orderNumber = newOrderNumber();

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: input.userId ?? null,
        email: input.email,
        status: "pending",
        currency: input.priced.currency,
        locale: input.locale,
        subtotalCents: input.priced.subtotalCents,
        discountCents: input.priced.discountCents,
        totalCents: input.priced.totalCents,
        promoCode: input.priced.promo.code,
      })
      .returning();

    await tx.insert(orderItems).values(
      input.priced.lines.map((line) => ({
        orderId: order.id,
        bookId: line.bookId,
        titleSnapshot: line.title,
        authorSnapshot: line.author,
        coverPathSnapshot: line.coverPath,
        unitPriceCents: line.unitPriceCents,
        quantity: line.quantity,
        lineTotalCents: line.lineTotalCents,
      })),
    );

    return order;
  });
}

/** Attaches the PayPal order id once it exists (used to reconcile webhooks). */
export async function attachPayPalOrder(orderId: string, paypalOrderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ paypalOrderId, paypalStatus: "CREATED", updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

export async function getOrderById(orderId: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderByNumber(orderNumber: string) {
  const rows = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderItems(orderId: string) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export type OrderWithLines = NonNullable<Awaited<ReturnType<typeof getOrderById>>> & {
  items: (typeof orderItems.$inferSelect)[];
};

/** Canonical UUID shape, so a reference is never mistaken for a human order number. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Order lookup used by the success page: by internal id or human reference. */
export async function findOrder(reference: string): Promise<OrderWithLines | null> {
  const order = UUID_RE.test(reference)
    ? await getOrderById(reference)
    : await getOrderByNumber(reference.toUpperCase());
  if (!order) return null;
  return { ...order, items: await getOrderItems(order.id) };
}

/**
 * Idempotent transition to `paid`.
 *
 * Called from the capture route *and* from the webhook. Whichever arrives
 * first performs the state change; the second call is a no-op that still
 * reports success, so PayPal never sees an error for a duplicate event.
 *
 * `webhookConfirmed` is what the admin panel displays: the payment is captured
 * but only cleared for delivery once PayPal's signed event confirms it.
 */
export async function confirmOrderPayment(input: {
  orderId: string;
  captureId?: string | null;
  payerEmail?: string | null;
  /** True when the call originates from a verified `PAYMENT.CAPTURE.COMPLETED`. */
  webhookConfirmed: boolean;
  paidAt?: Date;
}): Promise<{ changed: boolean; order: OrderWithLines }> {
  const existing = await findOrder(input.orderId);
  if (!existing) throw new OrderError("not_found");

  if (existing.status === "paid" || existing.status === "refunded") {
    // Already settled: never touch `paidAt` again.
    return { changed: false, order: existing };
  }

  const now = input.paidAt ?? new Date();
  const [updated] = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: existing.paidAt ?? now,
      paypalCaptureId: input.captureId ?? existing.paypalCaptureId,
      paypalStatus: input.captureId ? "CAPTURED" : existing.paypalStatus,
      paypalPayerEmail: input.payerEmail ?? existing.paypalPayerEmail,
      webhookConfirmedAt: input.webhookConfirmed ? now : existing.webhookConfirmedAt,
      updatedAt: now,
    })
    .where(and(eq(orders.id, input.orderId), sql`${orders.status} <> 'paid'`))
    .returning();

  const items = await getOrderItems(input.orderId);
  const order = updated ? { ...updated, items } : existing;

  // Only the transition that actually flipped the row to `paid` may consume a
  // promo use. Concurrent or replayed webhooks see `updated === undefined` and
  // must not increment `used_count` a second time.
  if (updated && input.webhookConfirmed && existing.promoCode) {
    await db
      .update(promoCodes)
      .set({ usedCount: sql`${promoCodes.usedCount} + 1` })
      .where(eq(promoCodes.code, existing.promoCode));
  }

  return { changed: Boolean(updated), order };
}

/**
 * Marks the confirmation email as sent. Returns `false` when another caller
 * already sent it, so a replayed webhook never mails the customer twice.
 */
export async function markOrderEmailed(orderId: string): Promise<boolean> {
  const [updated] = await db
    .update(orders)
    .set({ emailedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), sql`${orders.emailedAt} is null`))
    .returning({ id: orders.id });
  return Boolean(updated);
}

/** Orders still waiting for a PayPal webhook, used by the maintenance endpoint. */
export async function listOrdersAwaitingWebhook(limit = 50) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.status, "paid"), sql`${orders.webhookConfirmedAt} IS NULL`))
    .limit(limit);
}

/** Books a customer already owns — used to warn on duplicate purchases. */
export async function getOwnedBookIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ bookId: orderItems.bookId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        sql`${orders.status} IN ('paid')`,
        gt(orders.paidAt, new Date(0)),
      ),
    );
  return [...new Set(rows.map((row) => row.bookId))];
}

/** Adapts a stored order to the shape the email templates expect. */
export function toEmailOrder(order: OrderWithLines, locale: Locale): EmailOrder {
  return {
    orderNumber: order.orderNumber,
    email: order.email,
    locale,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      title: item.titleSnapshot,
      author: item.authorSnapshot,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

/**
 * Same payload plus one signed download link per line, for the confirmation
 * email sent by the webhook. Guest orders get expiring HMAC links; when the
 * PDF is not uploaded yet the template says so instead of linking nowhere.
 */
export async function toConfirmationEmail(
  order: OrderWithLines,
  locale: Locale,
): Promise<EmailOrder> {
  const base = toEmailOrder(order, locale);
  if (order.items.length === 0) return base;

  const fileRows = await db
    .select({ id: books.id, pdfPath: books.pdfPath })
    .from(books)
    .where(inArray(books.id, order.items.map((item) => item.bookId)));
  const fileByBook = new Map(fileRows.map((row) => [row.id, row.pdfPath]));

  return {
    ...base,
    items: order.items.map((item, index) => {
      const pdfPath = fileByBook.get(item.bookId);
      if (!pdfPath) {
        return { ...base.items[index], hasFile: false, downloadUrl: null };
      }
      return {
        ...base.items[index],
        hasFile: true,
        downloadUrl: order.userId ? null : guestDownloadUrl(item.id),
      };
    }),
  };
}

/** Validity window for a promo code, used by the admin form. */
export async function isPromoUsable(
  code: string,
  subtotalCents: number,
): Promise<{ usable: boolean; reason: "expired" | "invalid" | "min_subtotal" | null }> {
  const rows = await db
    .select()
    .from(promoCodes)
    .where(and(eq(promoCodes.code, code.trim().toUpperCase()), eq(promoCodes.isActive, true)))
    .limit(1);
  const promo = rows[0];
  if (!promo) return { usable: false, reason: "invalid" };

  const now = Date.now();
  const expired = promo.expiresAt ? promo.expiresAt.getTime() < now : false;
  const notStarted = promo.startsAt ? promo.startsAt.getTime() > now : false;
  if (expired || notStarted) return { usable: false, reason: "expired" };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { usable: false, reason: "invalid" };
  if (promo.minSubtotalCents > subtotalCents) return { usable: false, reason: "min_subtotal" };
  return { usable: true, reason: null };
}

/** Bounds helper reused by admin listings. */
export function inDateRange(column: typeof orders.createdAt, from: Date, to: Date) {
  return and(gte(column, from), lte(column, to));
}
