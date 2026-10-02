"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { signUpAction } from "@/app/actions/auth";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";

/**
 * Sign-up form.
 *
 * When Supabase requires email confirmation, the action returns
 * `checkEmail` instead of redirecting, and the form swaps to a confirmation
 * panel rather than showing an error.
 */
export function SignUpForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signUpAction({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        locale,
        next,
      });
      if (result?.error === "checkEmail") {
        setAwaitingEmail(true);
        return;
      }
      setError(result?.error ? t(`errors.${result.error}`) : null);
    });
  }

  if (awaitingEmail) {
    return (
      <AuthMessage tone="success">
        <p className="font-medium">{t("checkEmail")}</p>
        <p className="mt-1">{t("checkEmailBody")}</p>
      </AuthMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" autoComplete="name" required disabled={pending} />
      </div>

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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("signUp")}
      </Button>
    </form>
  );
}
