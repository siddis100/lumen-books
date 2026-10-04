"use client";

import { useState, type FormEvent } from "react";

import { CheckCircle2, Download, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

type DeliveryItem = {
  title: string;
  author: string;
  quantity: number;
  hasFile: boolean;
  downloadUrl: string | null;
};

type Recovered = {
  orderNumber: string;
  email: string;
  totalCents: number;
  paidAt: string | null;
  items: DeliveryItem[];
};

const ERROR_KEYS: Record<string, string> = {
  order_not_found: "errorNotFound",
  order_not_paid: "errorNotPaid",
  use_account: "errorUseAccount",
  rate_limited: "errorRateLimited",
  links_unavailable: "errorGeneric",
  invalid_params: "errorGeneric",
};

/**
 * Self-service re-delivery of a guest order.
 *
 * Two facts, both known to the buyer, are enough: the order reference PayPal
 * put in the return URL and the address the payment was made with. The server
 * mints fresh signed links, so this page keeps working whatever the
 * confirmation email does — lost inbox, spam folder, bounced sender.
 */
export function RecoverLinksForm({ locale }: { locale: Locale }) {
  const t = useTranslations("recover");
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<Recovered | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setErrorKey(null);
    setRecovered(null);

    try {
      const response = await fetch("/api/orders/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: String(form.get("orderNumber") ?? ""),
          email: String(form.get("email") ?? ""),
          locale,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Recovered & { error?: string };

      if (!response.ok) {
        setErrorKey(ERROR_KEYS[data.error ?? ""] ?? "errorGeneric");
        return;
      }
      setRecovered({
        orderNumber: data.orderNumber,
        email: data.email,
        totalCents: data.totalCents,
        paidAt: data.paidAt,
        items: Array.isArray(data.items) ? data.items : [],
      });
    } catch {
      setErrorKey("errorGeneric");
    } finally {
      setPending(false);
    }
  }

  if (recovered) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="font-medium">{t("foundTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {recovered.orderNumber} · {recovered.email}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {recovered.items.map((item, index) => (
            <li
              key={`${item.title}-${index}`}
              className="bg-card flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{item.author}</span>
              </span>
              {item.downloadUrl ? (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <a href={item.downloadUrl}>
                    <Download className="size-4" aria-hidden />
                    {t("download")}
                  </a>
                </Button>
              ) : (
                <span className="text-muted-foreground shrink-0 text-xs">{t("fileUnavailable")}</span>
              )}
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs">
          {t("linkValidHint")} {t("totalLabel")} {formatPrice(recovered.totalCents)}
        </p>

        <Button type="button" variant="outline" onClick={() => setRecovered(null)}>
          {t("anotherOrder")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="orderNumber">{t("orderNumber")}</Label>
        <Input
          id="orderNumber"
          name="orderNumber"
          type="text"
          autoComplete="off"
          placeholder="LB-260102-A1B2C3"
          required
          disabled={pending}
          dir="ltr"
        />
        <p className="text-muted-foreground text-xs">{t("orderNumberHint")}</p>
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
        <p className="text-muted-foreground text-xs">{t("emailHint")}</p>
      </div>

      {errorKey ? (
        <p
          role="alert"
          className="text-destructive flex items-start gap-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t(errorKey)}</span>
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {pending ? t("working") : t("submit")}
      </Button>
    </form>
  );
}
