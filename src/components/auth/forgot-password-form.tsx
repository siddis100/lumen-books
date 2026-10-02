"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";

/**
 * "Forgot password" form.
 *
 * The same neutral confirmation is shown whether or not the address exists, so
 * this page cannot be used to enumerate customers.
 */
export function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      await forgotPasswordAction({ email: String(form.get("email") ?? ""), locale });
      setSent(true);
    });
  }

  if (sent) {
    return (
      <AuthMessage tone="success">
        <p className="font-medium">{t("checkEmail")}</p>
        <p className="mt-1">{t("resetSent")}</p>
      </AuthMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("resetPassword")}
      </Button>
    </form>
  );
}