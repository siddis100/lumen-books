"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { claimGuestOrders } from "@/lib/account";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Authentication Server Actions.
 *
 * Every action follows the same contract: parse → rate limit → Supabase call →
 * return a flat `{ error }` or `{ ok }` result, and redirect on success. Error
 * codes are language-neutral so the client maps them to `auth.errors.*`.
 *
 * Guest orders bought with the same email are attached to the account after a
 * successful sign-in/sign-up, so a customer's library appears immediately.
 */

export type AuthResult = { error?: string; ok?: boolean };

async function callerIp(): Promise<string> {
  return clientIp(new Request("http://localhost", { headers: await headers() }));
}

/** Only allow internal, locale-prefixed paths as a post-login destination. */
function safeNext(next: string | undefined, locale: string, fallback = "/account"): string {
  const candidate = next?.trim();
  if (!candidate) return `/${locale}${fallback}`;
  // Block protocol-relative URLs (`//evil.com`) and absolute URLs.
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return `/${locale}${fallback}`;
  return candidate.startsWith(`/${locale}`) ? candidate : `/${locale}${candidate}`;
}

async function attachGuestOrders(userId: string, email: string, locale: string): Promise<void> {
  const claimed = await claimGuestOrders(userId, email);
  if (claimed > 0) {
    revalidatePath(`/${locale}/account`, "layout");
    revalidatePath(`/${locale}/account/downloads`);
  }
}

/* ------------------------------------------------------------------ *
 * Sign in
 * ------------------------------------------------------------------ */

export async function signInAction(input: unknown): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { error: "invalidCredentials" };

  const { email, password, locale, next } = parsed.data;
  const ip = await callerIp();
  if (!(await rateLimit("auth-sign-in", ip, 10, 600)).ok) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately the same message as a wrong address: we must not reveal
  // whether an email has an account.
  if (error) return { error: "invalidCredentials" };

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { error: "generic" };

  await attachGuestOrders(user.id, email, locale);
  redirect(safeNext(next, locale));
}

/* ------------------------------------------------------------------ *
 * Sign up
 * ------------------------------------------------------------------ */

export async function signUpAction(input: unknown): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { error: code === "weakPassword" ? "weakPassword" : "generic" };
  }

  const { name, email, password, locale, next } = parsed.data;
  const ip = await callerIp();
  if (!(await rateLimit("auth-sign-up", ip, 5, 3600)).ok) return { error: "generic" };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: origin ? `${origin}/${locale}/auth/confirm` : undefined,
    },
  });

  if (error) {
    // Supabase reports duplicate accounts in several ways; all map to one code.
    const isDuplicate =
      /already|registered|exists/i.test(error.message) ||
      error.status === 422 ||
      error.status === 400;
    return { error: isDuplicate ? "emailTaken" : "generic" };
  }

  // No session yet? Supabase requires email confirmation: the customer must
  // click the link we just sent before the library can be shown.
  if (!data.session || !data.user) return { ok: true, error: "checkEmail" };

  await attachGuestOrders(data.user.id, email, locale);
  redirect(safeNext(next, locale));
}

/* ------------------------------------------------------------------ *
 * Password reset
 * ------------------------------------------------------------------ */

export async function forgotPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "generic" };

  const ip = await callerIp();
  if (!(await rateLimit("auth-forgot", ip, 5, 3600)).ok) return { error: "generic" };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  // Always report success: whether the address exists is not our business here.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/api/auth/callback?next=/${parsed.data.locale}/auth/reset-password` : undefined,
  });

  return { ok: true };
}

export async function resetPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "weakPassword" };

  const { password, confirmPassword, locale } = parsed.data;
  if (password !== confirmPassword) return { error: "generic" };

  const ip = await callerIp();
  if (!(await rateLimit("auth-reset", ip, 8, 3600)).ok) return { error: "generic" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "generic" };

  redirect(`/${locale}/account`);
}

/* ------------------------------------------------------------------ *
 * Sign out
 * ------------------------------------------------------------------ */

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get("locale") ?? "en");
  const target = locale === "fr" || locale === "ar" ? locale : "en";

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath(`/${target}/account`, "layout");
  redirect(`/${target}`);
}
