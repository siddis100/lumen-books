import { z } from "zod";

export const bookFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  subtitle: z.string().max(300).optional(),
  author: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use kebab-case slugs"),
  categoryId: z.string().uuid("Invalid category").optional().or(z.literal("")),
  description: z.string().min(10),
  excerpt: z.string().max(1000).optional(),
  priceCents: z.coerce.number().int().min(0),
  compareAtCents: z.coerce.number().int().min(0).optional(),
  language: z.enum(["en", "fr", "ar", "es", "de", "pt", "other"]).default("en"),
  formats: z.array(z.enum(["epub", "pdf"])).min(1, "Select at least one format"),
  pages: z.coerce.number().int().min(1).optional(),
  isbn: z.string().max(40).optional(),
  publishedAt: z.string().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isDemo: z.boolean().default(false),
});

export type BookFormValues = z.infer<typeof bookFormSchema>;

export const categoryFormSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().min(2),
  nameFr: z.string().optional(),
  nameAr: z.string().optional(),
  descriptionEn: z.string().max(500).optional(),
  descriptionFr: z.string().max(500).optional(),
  descriptionAr: z.string().max(500).optional(),
  position: z.coerce.number().int().default(0),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const promoFormSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  kind: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(1),
  minSubtotalCents: z.coerce.number().int().min(0).default(0),
  maxUses: z.coerce.number().int().positive().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type PromoFormValues = z.infer<typeof promoFormSchema>;

export const reviewSchema = z.object({
  bookId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(10).max(2000),
});

export type ReviewValues = z.infer<typeof reviewSchema>;

export const newsletterSchema = z.object({
  email: z.string().email(),
  locale: z.string().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  orderNumber: z.string().max(60).optional(),
  subject: z.string().min(2).max(120),
  body: z.string().min(10).max(2000),
});

export const cartCheckoutSchema = z.object({
  email: z.string().email("A valid email is required"),
  promoCode: z.string().max(40).optional(),
  terms: z.literal(true, { error: "You must accept the terms" }),
});

export type CartCheckoutValues = z.infer<typeof cartCheckoutSchema>;

/**
 * Checkout payload. Note that prices are absent by design: the server reads
 * them from the catalogue so a tampered cart cannot change the amount.
 */
export const checkoutPayloadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
  items: z
    .array(
      z.object({
        bookId: z.string().uuid("Invalid book reference"),
        quantity: z.coerce.number().int().min(1).max(10),
      }),
    )
    .min(1, "Your cart is empty")
    .max(20, "Too many different titles in one order"),
  promoCode: z.string().trim().max(40).optional(),
  terms: z.literal(true, { error: "You must accept the terms" }),
});

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;

/* ------------------------------------------------------------------ *
 * Auth & profile
 * ------------------------------------------------------------------ */

/** Supabase requires 8+ characters; we ask for a little more entropy. */
const passwordSchema = z.string().min(8).max(72).regex(/[a-zA-Z]/, "weakPassword").regex(/[0-9]/, "weakPassword");

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
  /** Locale-aware destination after a successful sign-in. */
  locale: z.enum(["en", "fr", "ar"]).default("en"),
  next: z.string().startsWith("/").max(200).optional(),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  locale: z.enum(["en", "fr", "ar"]).default("en"),
  next: z.string().startsWith("/").max(200).optional(),
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string().min(1).max(72),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "required").max(80),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
});
export type ProfileValues = z.infer<typeof profileSchema>;