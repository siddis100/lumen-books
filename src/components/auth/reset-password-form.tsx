"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { resetPasswordAction } from "@/app/actions/auth";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";

/**
 * New-password form, reached from the recovery link.
 *
 * The recovery code has already been exchanged for a session by
 * `/api/auth/callback`, so `updateUser` is enough — no password handling here.
 */
export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError(t("errors.generic"));
      return;
    }

    startTransition(async () => {
      const result = await resetPasswordAction({ password, confirmPassword, locale });
      setError(result?.error ? t(`errors.${result.error}`) : null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          aria-describedby="password-hint"
          dir="ltr"
        />
        <p id="password-hint" className="text-muted-foreground text-xs">
          {t("passwordHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("resetPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          dir="ltr"
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("resetPassword")}
      </Button>
    </form>
  );
}