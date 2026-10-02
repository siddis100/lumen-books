"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCartStore, selectCartCount } from "@/stores/cart";

export type AddToCartBook = {
  id: string;
  /** Optional URL slug used by the cart to link back to the book page. */
  slug?: string;
  title: string;
  author: string;
  priceCents: number;
  coverPath: string | null;
};

/**
 * Adds a book to the client cart. The stored price is display-only: the
 * checkout route re-reads the catalogue and recomputes the total server-side.
 */
export function AddToCart({
  book,
  showQuantity = false,
  className,
  size = "default",
}: {
  book: AddToCartBook;
  showQuantity?: boolean;
  className?: string;
  size?: "default" | "lg";
}) {
  const t = useTranslations("book");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const count = useCartStore(selectCartCount);

  function handleAdd() {
    addItem(book, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    toast.success(t("addedToCart"), {
      description: `${book.title} × ${quantity}`,
      action: {
        label: tCart("viewCart"),
        onClick: () => {
          window.location.href = `/${locale}/cart`;
        },
      },
    });
  }

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      {showQuantity ? (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm font-medium">{tCart("quantity")}</span>
          <div className="border-border flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              aria-label={tCart("decreaseQuantity")}
            >
              <Minus className="size-4" />
            </Button>
            <span aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setQuantity((value) => Math.min(10, value + 1))}
              disabled={quantity >= 10}
              aria-label={tCart("increaseQuantity")}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {count > 0 ? (
            <span className="text-muted-foreground text-xs">
              {tCart("itemsInCart", { count })}
            </span>
          ) : null}
        </div>
      ) : null}

      <Button
        size={size}
        onClick={handleAdd}
        className={size === "lg" ? "h-12 w-full text-base" : "h-10"}
        aria-label={`${t("addToCart")}: ${book.title}`}
      >
        {added ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            {t("inCart")}
          </>
        ) : (
          <>
            <ShoppingCart className="size-4" aria-hidden="true" />
            {t("addToCart")}
          </>
        )}
      </Button>
    </div>
  );
}