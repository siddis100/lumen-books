"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { signInAction } from "@/app/actions/auth";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";

/**
 * Sign-in form.
 *
 * Submits to a Server Action and maps its language-neutral error code onto
 * `auth.errors.*`. The button shows a spinner and stays disabled while the
 * action runs; the error is announced politely.
 */
export function SignInForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signInAction({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        locale,
        next,
      });
      // No redirect happened ⇒ the action returned an error code.
      setError(result?.error ? t(`errors.${result.error}`) : null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          dir="ltr"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("signIn")}
      </Button>

      <p className="text-muted-foreground text-sm">
        <a
          href={`/${locale}/auth/forgot-password`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {t("forgotPassword")}
        </a>
      </p>
    </form>
  );
}
