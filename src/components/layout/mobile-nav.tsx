"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CartButton } from "@/components/layout/cart-button";
import { SignInButton } from "@/components/layout/user-menu";
import type { HeaderUser } from "@/components/layout/user-menu";

export type NavLink = { href: string | { pathname: string; query?: Record<string, string | number> }; label: string };

/** Slide-over navigation for small screens. */
export function MobileNav({
  links,
  user,
  categoryLinks = [],
}: {
  links: NavLink[];
  user: HeaderUser | null;
  categoryLinks?: NavLink[];
}) {
  const t = useTranslations("nav");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const pathname = usePathname();
    // The drawer opens from the side the reading direction starts on.
  const side = isRtl(locale) ? "right" : "left";

  // Closing after a navigation is derived, not synchronised from an effect: the
  // sheet stays open only while the pathname is the one it was opened on, so
  // following a link closes it without an extra render pass.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const isOpen = openedOn === pathname;
  const control = (next: boolean) => setOpenedOn(next ? pathname : null);

  return (
    <Sheet open={isOpen} onOpenChange={control}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 lg:hidden"
          aria-label={t("openMenu")}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className="w-88 p-0">
        <SheetHeader className="flex-row items-center justify-between border-b px-5 py-4">
          <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
          <Link href="/" onClick={() => control(false)}>
            <Logo />
          </Link>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("closeMenu")}>
              <X className="size-5" />
            </Button>
          </SheetTrigger>
        </SheetHeader>

        <nav aria-label={t("openMenu")} className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="hover:bg-muted rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {categoryLinks.length > 0 ? (
            <div className="mt-3 border-t pt-3">
              <p className="text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wider uppercase">
                {tCatalog("category")}
              </p>
              {categoryLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="hover:bg-muted block rounded-lg px-3 py-2 text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-1">
              <LocaleSwitcher />
              <ThemeToggle />
              <CartButton />
            </div>
            {user ? (
              <Button asChild size="sm" className="h-9">
                <Link href="/account">{t("account")}</Link>
              </Button>
            ) : (
              <SignInButton className="h-9" />
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}