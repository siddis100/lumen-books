"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Newsletter sign-up. The address is validated twice: in the browser for instant
 * feedback, and again on the server with Zod before anything is written.
 */
export function NewsletterForm({ source = "home" }: { source?: string }) {
  const t = useTranslations("home.newsletter");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      toast.error(t("invalid"));
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, source }),
      });
      if (!res.ok) {
        toast.error(t("error"));
        return;
      }
      setDone(true);
      setEmail("");
      toast.success(t("success"));
    });
  }

  if (done) {
    return (
      <div className="bg-brand/10 text-brand inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
        <Check className="size-4" aria-hidden="true" />
        {t("success")}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md" noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            className="text-muted-foreground pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            className="h-11 ps-9"
            dir="ltr"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 px-6" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("cta")}
        </Button>
      </div>
      <p className="text-muted-foreground mt-3 text-xs text-pretty">{t("privacyNote")}</p>
    </form>
  );
}
