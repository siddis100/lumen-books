"use client";

import { useState, useTransition } from "react";
import { LayoutDashboard, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type HeaderUser = {
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

/** Account menu: orders/downloads, admin entry when allowed, sign out. */
export function UserMenu({ user }: { user: HeaderUser }) {
  const t = useTranslations("nav");
  const tAccount = useTranslations("account");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initials =
    user.fullName?.trim().slice(0, 2).toUpperCase() ||
    user.email.slice(0, 2).toUpperCase() ||
    "LB";

  function signOut() {
    startTransition(async () => {
      await createClient().auth.signOut();
      window.location.href = `/${window.location.pathname.split("/")[1] || "en"}`;
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          aria-label={t("account")}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand/10 text-brand text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {user.fullName || tAccount("guest")}
          </span>
          <span className="text-muted-foreground truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" />
            {tAccount("title")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/orders">
            <User className="size-4" />
            {tAccount("orders")}
          </Link>
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="size-4" />
              {t("adminPanel")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={signOut}
          disabled={isPending}
          variant="destructive"
          data-active={pathname === "/account" ? "" : undefined}
        >
          <LogOut className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sign-in CTA shown to anonymous visitors. */
export function SignInButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Button asChild size="sm" className={className}>
      <Link href="/auth/sign-in">{t("signIn")}</Link>
    </Button>
  );
}