"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCartStore, selectCartSubtotal } from "@/stores/cart";
import { coverUrl } from "@/lib/storage-url";
import { formatPrice } from "@/lib/money";

/**
 * Cart view.
 *
 * The line prices come from the cart store for instant feedback, but the totals
 * shown in the summary are fetched from `/api/cart/price`, which recomputes
 * everything from the database. A tampered localStorage entry therefore cannot
 * make the cart look cheaper than what PayPal will actually charge.
 */
export function CartView() {
  const t = useTranslations("cart");
  const tCheckout = useTranslations("checkout");

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQty = useCartStore((state) => state.updateQty);
  const clear = useCartStore((state) => state.clear);
  const localSubtotal = useCartStore(selectCartSubtotal);

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [pricing, setPricing] = useState<{
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    promoValid: boolean;
  } | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const cartKey = useMemo(
    () => items.map((item) => `${item.id}:${item.quantity}`).join("|"),
    [items],
  );

  // Re-price from the server whenever the cart or the promo code changes. The
  // work is deferred behind the debounce, including the reset for an empty
  // cart: writing state in the synchronous effect body triggers a cascading
  // render on every keystroke in the promo field.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (items.length === 0) {
        setPricing(null);
        setPriceError(null);
        return;
      }
      try {
        const response = await fetch("/api/cart/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({ bookId: item.id, quantity: item.quantity })),
            promoCode: promo ?? undefined,
          }),
        });
        if (cancelled) return;
        if (!response.ok) {
          const failed = (await response.json().catch(() => null)) as { error?: string } | null;
          setPricing(null);
          setPriceError(failed?.error ?? "pricing_unavailable");
          return;
        }
        const data = (await response.json()) as {
          subtotalCents: number;
          discountCents: number;
          totalCents: number;
          promoValid: boolean;
        };
        setPricing(data);
        setPriceError(null);
      } catch {
        // Offline or DB hiccup: keep showing the local subtotal.
        setPriceError(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cartKey, promo, items.length]);

  const count = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = pricing?.subtotalCents ?? localSubtotal;
  const discount = pricing?.discountCents ?? 0;
  const total = pricing?.totalCents ?? Math.max(0, localSubtotal);

  if (items.length === 0) {
    return (
      <div className="bg-card flex flex-col items-center gap-5 rounded-2xl border px-6 py-16 text-center">
        <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
          <ShoppingBag className="size-6" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">{t("empty")}</h2>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{t("emptyHint")}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/books">{t("emptyCta")}</Link>
        </Button>
      </div>
    );
  }

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromo(code);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{t("itemsInCart", { count })}</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              clear();
              setPromo(null);
              setPromoInput("");
            }}
          >
            <Trash2 className="size-4 rtl-flip" aria-hidden="true" />
            {t("clear")}
          </Button>
        </div>

        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 border-b py-5 first:border-t">
              <Link
                href={`/books/${item.slug ?? item.id}`}
                className="bg-muted relative h-28 w-20 shrink-0 overflow-hidden rounded-lg"
              >
                <Image
                  src={coverUrl(item.coverPath)}
                  alt={`${item.title} — cover`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display truncate text-sm font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground truncate text-xs">{item.author}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatPrice(item.priceCents * item.quantity)}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="border-border flex items-center rounded-lg border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t("decreaseQuantity")}
                      onClick={() => updateQty(item.id, item.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t("increaseQuantity")}
                      onClick={() => updateQty(item.id, item.quantity + 1)}
                      disabled={item.quantity >= 10}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    {t("remove")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Button asChild variant="ghost" className="mt-6">
          <Link href="/books">{t("continueShopping")}</Link>
        </Button>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-card flex flex-col gap-5 rounded-2xl border p-6">
          <h2 className="font-display text-lg font-semibold">{tCheckout("orderSummary")}</h2>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t("subtotal")}</dt>
              <dd className="font-medium tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-emerald-600">
                <dt>{t("discount")}</dt>
                <dd className="font-medium tabular-nums">-{formatPrice(discount)}</dd>
              </div>
            ) : null}
          </dl>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">{t("total")}</span>
            <span className="font-display text-xl font-bold tabular-nums">{formatPrice(total)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="promo"
              className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
            >
              <Tag className="size-3.5" aria-hidden="true" />
              {t("promoLabel")}
            </label>
            <div className="flex gap-2">
              <Input
                id="promo"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                placeholder={t("promoPlaceholder")}
                autoComplete="off"
                className="uppercase"
              />
              {promo ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                >
                  {t("promoRemove")}
                </Button>
              ) : (
                <Button variant="outline" onClick={applyPromo}>
                  {t("promoApply")}
                </Button>
              )}
            </div>
            {promo && pricing ? (
              pricing.promoValid ? (
                <p className="text-xs text-emerald-600">
                  {t("promoApplied", { code: promo, amount: formatPrice(discount) })}
                </p>
              ) : (
                <p className="text-destructive text-xs">{t("promoInvalid")}</p>
              )
            ) : null}
          </div>

          {priceError ? (
            <p className="text-destructive text-xs" role="alert">
              {priceError === "book_no_file" || priceError === "book_unavailable"
                ? t("unavailable")
                : priceError === "book_not_found"
                  ? t("missingTitle")
                  : t("pricingFailed")}
            </p>
          ) : null}

          <Button asChild size="lg" className="w-full">
            <Link
              href={promo ? { pathname: "/checkout", query: { promo } } : "/checkout"}
              aria-disabled={priceError ? true : undefined}
              tabIndex={priceError ? -1 : undefined}
              className={priceError ? "pointer-events-none opacity-60" : undefined}
            >
              {t("checkout")}
            </Link>
          </Button>

          <ul className="text-muted-foreground flex flex-col gap-1.5 text-xs">
            <li>{t("digitalNotice")}</li>
            <li>{t("taxNotice")}</li>
            <li>{t("freeDownloads")}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
