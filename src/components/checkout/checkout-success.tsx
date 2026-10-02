"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { useCartStore } from "@/stores/cart";

type Phase = "capturing" | "confirmed" | "pending" | "failed";

/**
 * Post-PayPal landing page.
 *
 * Runs two steps: capture the approved order, then poll until PayPal's signed
 * webhook has confirmed it. Downloads are only offered once `downloadsReady`
 * is true, so a customer never gets a dead link after paying.
 */
export function CheckoutSuccess({
  orderNumber,
  paypalOrderId,
}: {
  orderNumber: string;
  paypalOrderId: string;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");

  const [phase, setPhase] = useState<Phase>("capturing");
  const [totalCents, setTotalCents] = useState<number | null>(null);
  const started = useRef(false);
  const clearCart = useCartStore((state) => state.clear);

  // Polls the order until the webhook unlocks the downloads. Iterative on
  // purpose: a recursive callback would have to reference itself from inside
  // its own initialiser.
  const poll = useCallback(async (): Promise<void> => {
    const url = `/api/orders/status?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(paypalOrderId)}`;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        // A failing status endpoint is most likely a transient blip: retry it
        // quickly, then fall through to the pending state.
        if (attempt >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      const data = (await response.json()) as {
        webhookConfirmed: boolean;
        downloadsReady: boolean;
        totalCents: number;
      };
      setTotalCents(data.totalCents);
      if (data.downloadsReady) {
        setPhase("confirmed");
        return;
      }
      // PayPal usually confirms within a few seconds; give it ~20s.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setPhase("pending");
  }, [orderNumber, paypalOrderId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber, paypalOrderId }),
        });
        const data = (await response.json()) as { ok?: boolean; totalCents?: number };
        if (!response.ok || !data.ok) {
          setPhase("failed");
          return;
        }
        if (typeof data.totalCents === "number") setTotalCents(data.totalCents);
        // The payment went through: the order now lives in the database, so the
        // local cart can be emptied. On failure or cancellation it is kept.
        clearCart();
        await poll();
      } catch {
        setPhase("failed");
      }
    })();
  }, [orderNumber, paypalOrderId, poll, clearCart]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
      {phase === "capturing" ? (
        <>
          <Loader2 className="text-brand size-10 animate-spin" aria-hidden="true" />
          <h1 className="font-display text-2xl font-semibold">{t("processing")}</h1>
        </>
      ) : null}

      {phase === "confirmed" ? (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold">{t("success")}</h1>
            <p className="text-muted-foreground text-sm">{t("successBody")}</p>
          </div>
          <div className="bg-card w-full space-y-2 rounded-2xl border p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("orderNumber")}</span>
              <span className="font-semibold">{orderNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("orderTotal")}</span>
              <span className="font-semibold tabular-nums">
                {totalCents === null ? "—" : formatPrice(totalCents)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/account/downloads">{t("goToAccount")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/books">{tc("continueShopping")}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">{t("guestNote")}</p>
        </>
      ) : null}

      {phase === "pending" ? (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Clock className="size-7" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold">{t("success")}</h1>
            <p className="text-muted-foreground text-sm">{t("successPending")}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            {t("orderNumber")} <span className="font-semibold">{orderNumber}</span>
          </p>
          <Button asChild size="lg">
            <Link href="/account/orders">{t("goToAccount")}</Link>
          </Button>
          <p className="text-muted-foreground text-xs">{t("guestNote")}</p>
        </>
      ) : null}

      {phase === "failed" ? (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Clock className="size-7" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold">{t("failed")}</h1>
            <p className="text-muted-foreground text-sm">{t("failedBody")}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/checkout">{t("tryAgain")}</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
