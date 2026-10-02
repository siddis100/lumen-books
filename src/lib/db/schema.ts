import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Enums (kept as text + TS unions so they stay readable and portable)
 * ------------------------------------------------------------------ */

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BOOK_FORMATS = ["epub", "pdf"] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

export const BOOK_LANGUAGES = ["en", "fr", "ar", "es", "de", "pt", "other"] as const;
export type BookLanguage = (typeof BOOK_LANGUAGES)[number];

export const ORDER_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const PROMO_KINDS = ["percent", "fixed"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

/* ------------------------------------------------------------------ *
 * Tables
 * ------------------------------------------------------------------ */

/** One row per Supabase auth user. Created by trigger on `auth.users`. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    role: text("role").$type<UserRole>().notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profiles_email_idx").on(t.email)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    // Translated names keep the catalogue readable in EN / FR / AR.
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr"),
    nameAr: text("name_ar"),
    descriptionEn: text("description_en"),
    descriptionFr: text("description_fr"),
    descriptionAr: text("description_ar"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    author: text("author").notNull(),

    description: text("description").notNull(),
    excerpt: text("excerpt"),

    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),

    /** Money is stored in integer USD cents — never floats. */
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    currency: text("currency").notNull().default("USD"),

    language: text("language").$type<BookLanguage>().notNull().default("en"),
    formats: text("formats").array().$type<BookFormat[]>().notNull().default(["epub", "pdf"]),
    pages: integer("pages"),
    isbn: text("isbn"),
    publishedAt: date("published_at"),

    /** Paths inside the Supabase Storage buckets, never public URLs. */
    coverPath: text("cover_path"),
    pdfPath: text("pdf_path"),
    pdfSizeBytes: integer("pdf_size_bytes"),
    pdfMimeType: text("pdf_mime_type"),

    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    /** Demo titles are temporary fixtures used to validate the shop; removed at launch. */
    isDemo: boolean("is_demo").notNull().default(false),

    salesCount: integer("sales_count").notNull().default(0),
    ratingAvg: numeric("rating_avg", { precision: 5, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("books_slug_idx").on(t.slug),
    index("books_category_idx").on(t.categoryId),
    index("books_active_idx").on(t.isActive),
    index("books_published_idx").on(t.publishedAt),
    index("books_price_idx").on(t.priceCents),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    email: text("email").notNull(),

    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    currency: text("currency").notNull().default("USD"),

    /** Language chosen at checkout, so webhook-only confirmations use the right copy. */
    locale: text("locale").notNull().default("en"),

    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    promoCode: text("promo_code"),

    /** PayPal Orders API v2 identifiers, used for reconciliation. */
    paypalOrderId: text("paypal_order_id"),
    paypalCaptureId: text("paypal_capture_id"),
    paypalStatus: text("paypal_status"),
    paypalPayerEmail: text("paypal_payer_email"),
    /** Set only once PAYMENT.CAPTURE.COMPLETED has been verified via webhook. */
    webhookConfirmedAt: timestamp("webhook_confirmed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Set once the confirmation email carrying the download links has been sent. */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),

    adminNote: text("admin_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.orderNumber),
    uniqueIndex("orders_paypal_idx").on(t.paypalOrderId),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    // Snapshot data so historic invoices stay correct even if the book changes.
    titleSnapshot: text("title_snapshot").notNull(),
    authorSnapshot: text("author_snapshot").notNull(),
    coverPathSnapshot: text("cover_path_snapshot"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull().default(1),
    lineTotalCents: integer("line_total_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_book_idx").on(t.bookId)],
);

/** Immutable record of every successful file download (audit + abuse control). */
export const downloads = pgTable(
  "downloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("downloads_item_idx").on(t.orderItemId), index("downloads_user_idx").on(t.userId)],
);

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    kind: text("kind").$type<PromoKind>().notNull(),
    /** percent => 0-100, fixed => cents in USD. */
    value: integer("value").notNull(),
    minSubtotalCents: integer("min_subtotal_cents").notNull().default(0),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("promo_codes_code_idx").on(t.code)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    status: text("status").$type<ReviewStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_book_idx").on(t.bookId), index("reviews_status_idx").on(t.status)],
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    locale: text("locale"),
    source: text("source").default("home"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("newsletter_email_idx").on(t.email)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    orderNumber: text("order_number"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_handled_idx").on(t.handled)],
);

/**
 * Fixed-window rate limiter backed by Postgres so it works across serverless
 * instances (an in-memory Map would reset on every cold start).
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

/** Free-form key/value store for operational settings. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */

export const profilesRelations = relations(profiles, ({ many }) => ({
  orders: many(orders),
  reviews: many(reviews),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  books: many(books),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  category: one(categories, {
    fields: [books.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(profiles, {
    fields: [orders.userId],
    references: [profiles.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  book: one(books, {
    fields: [orderItems.bookId],
    references: [books.id],
  }),
  downloads: many(downloads),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  book: one(books, {
    fields: [reviews.bookId],
    references: [books.id],
  }),
}));

export const downloadsRelations = relations(downloads, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [downloads.orderItemId],
    references: [orderItems.id],
  }),
}));

/* ------------------------------------------------------------------ *
 * Derived types
 * ------------------------------------------------------------------ */

export type Category = typeof categories.$inferSelect;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PromoCode = typeof promoCodes.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Profile = typeof profiles.$inferSelect;

/** Book joined with its category — the shape the storefront consumes. */
export type BookWithCategory = Book & { category: Category | null };

/** Order with its line items — the shape order emails / account pages consume. */
export type OrderWithItems = Order & { items: OrderItem[] };

export type RateLimitBucket = {
  key: string;
  count: number;
  windowStart: Date;
};

export const rateLimitKey = (bucket: string, id: string) => `${bucket}:${id}`;

export { primaryKey };