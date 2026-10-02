"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateProfileAction } from "@/app/actions/profile";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/routing";

/**
 * Profile form. Only the display name is editable: the email belongs to the
 * authentication system and the role is never client-writable.
 */
export function ProfileForm({
  locale,
  fullName,
  email,
}: {
  locale: Locale;
  fullName: string;
  email: string;
}) {
  const t = useTranslations("account.profile");
  const tc = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"saved" | "error" | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: String(form.get("fullName") ?? ""),
        locale,
      });
      setState(result?.ok ? "saved" : "error");
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("name")}</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          required
          maxLength={80}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" value={email} readOnly disabled dir="ltr" />
      </div>

      {state === "saved" ? <AuthMessage tone="success">{t("saved")}</AuthMessage> : null}
      {state === "error" ? <AuthMessage tone="error">{tc("error")}</AuthMessage> : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("save")}
      </Button>
    </form>
  );
}