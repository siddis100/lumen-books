"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { AlertCircle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { useCartStore, selectCartSubtotal } from "@/stores/cart";
import { coverUrl } from "@/lib/storage-url";
import { formatPrice } from "@/lib/money";

/** Stable empty subscribe: this store never changes after hydration. */
const noopSubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * Checkout form.
 *
 * The only thing the browser decides is *which* books and which email: prices,
 * discounts and the amount sent to PayPal are computed server-side
 * (`POST /api/checkout`). Nothing typed here can change what is charged.
 */
export function CheckoutClient({ promoCode }: { promoCode?: string }) {
  const t = useTranslations("checkout");
  const tCart = useTranslations("cart");
  const tFooter = useTranslations("footer");
  const locale = useLocale();

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore(selectCartSubtotal);

  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Hydration guard: the cart lives in localStorage, so the server render must
  // not decide whether the page is empty. `useSyncExternalStore` serves `false`
  // during SSR and `true` after hydration without writing state from an effect.
  const hydrated = useSyncExternalStore(noopSubscribe, clientSnapshot, serverSnapshot);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()), [email]);

  function checkoutErrorMessage(code?: string): string {
    switch (code) {
      case "promo_invalid":
        return tCart("promoInvalid");
      case "promo_min_subtotal":
        return tCart("promoMinSubtotalShort");
      case "promo_expired":
        return tCart("promoExpired");
      case "book_no_file":
        return tCart("unavailable");
      case "book_unavailable":
        return tCart("unavailable");
      case "book_not_found":
        return tCart("missingTitle");
      case "rate_limited":
        return tCart("tooManyAttempts");
      default:
        return t("error");
    }
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card flex flex-col items-center gap-5 rounded-2xl border px-6 py-16 text-center">
        <h2 className="font-display text-xl font-semibold">{t("emptyCart")}</h2>
        <Button asChild size="lg">
          <Link href="/cart">{t("backToCart")}</Link>
        </Button>
      </div>
    );
  }

  async function submit() {
    setError(null);
    setFieldError(null);

    if (!emailValid) {
      setFieldError(t("emailInvalid"));
      return;
    }
    if (!terms) {
      setFieldError(t("termsRequired"));
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          locale,
          promoCode: promoCode?.trim() || undefined,
          terms: true,
          items: items.map((item) => ({ bookId: item.id, quantity: item.quantity })),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        approvalUrl?: string | null;
        orderNumber?: string;
        paypalOrderId?: string;
      };

      if (!response.ok || !data.paypalOrderId || !data.approvalUrl) {
        setError(checkoutErrorMessage(data.error));
        setPending(false);
        return;
      }

      // The cart is NOT cleared here: PayPal can still be cancelled, and the
      // shopper must find their items again on `/checkout/cancelled`. It is
      // emptied by the success page, once the capture has actually succeeded.
      window.location.href = data.approvalUrl;
    } catch {
      setError(t("error"));
      setPending(false);
    }
  }

  const total = subtotal;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
      <div className="min-w-0">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm font-medium">
            {t("email")}
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            aria-invalid={Boolean(fieldError)}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">{t("emailHint")}</p>
        </div>

        <div className="mt-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={terms}
              onCheckedChange={(checked) => {
                setTerms(checked === true);
                if (fieldError) setFieldError(null);
              }}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-sm leading-snug font-normal">
              {t("termsAccept")}
            </Label>
          </div>
          <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 ps-7 text-xs">
            <Link href="/legal/terms" className="hover:text-brand underline underline-offset-4">
              {tFooter("terms")}
            </Link>
            <Link href="/legal/refund" className="hover:text-brand underline underline-offset-4">
              {tFooter("refund")}
            </Link>
            <Link href="/legal/privacy" className="hover:text-brand underline underline-offset-4">
              {tFooter("privacy")}
            </Link>
          </p>
        </div>

        {fieldError ? (
          <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="size-4" aria-hidden="true" />
            {fieldError}
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="bg-card mt-8 rounded-2xl border p-6">
          <div className="flex items-center gap-2">
            <Lock className="text-muted-foreground size-4" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">{t("orderSummary")}</h2>
          </div>

          <ul className="mt-5 flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4">
                <span className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={coverUrl(item.coverPath)}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">{item.author}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  × {item.quantity}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatPrice(item.priceCents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-5" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">{t("orderTotal")}</span>
            <span className="font-display text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
          </div>

          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={submit}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("processing")}
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("payWithPaypal")}
              </>
            )}
          </Button>

          <p className="text-muted-foreground mt-3 text-center text-xs">{t("securityNote")}</p>
        </div>

        <p className="text-muted-foreground mt-6 text-xs">{tCart("digitalNotice")}</p>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-muted/40 flex flex-col gap-4 rounded-2xl border p-6">
          <h2 className="font-display text-base font-semibold">{t("needAccount")}</h2>
          <p className="text-muted-foreground text-sm">{t("createAccountHint")}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/auth/sign-up">{t("goToAccount")}</Link>
          </Button>
          <Separator />
          <p className="text-muted-foreground text-xs">{t("guestNote")}</p>
        </div>
      </aside>
    </div>
  );
}
