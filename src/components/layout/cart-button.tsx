"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { selectCartCount, useCartStore } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cart trigger. The count badge is derived from the persisted cart store, so it
 * only updates on the client — hence the mounted guard to avoid a hydration
 * mismatch on the very first paint.
 */
export function CartButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const count = useCartStore(selectCartCount);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground hover:text-foreground relative size-9", className)}
    >
      <Link href="/cart" aria-label={t("cartWithCount", { count })}>
        <ShoppingBag className="size-4.5" />
        {count > 0 ? (
          <span className="bg-brand text-brand-foreground absolute -top-0.5 -end-0.5 grid min-w-4.5 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}