"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/common/logo";
import { CartButton } from "@/components/layout/cart-button";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { MobileNav, type NavLink } from "@/components/layout/mobile-nav";
import { SearchDialog, SearchTrigger } from "@/components/layout/search-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SignInButton, UserMenu, type HeaderUser } from "@/components/layout/user-menu";

export type HeaderCategory = { slug: string; name: string };

const NEWEST = { sort: "newest" };
const BESTSELLING = { sort: "bestselling" };

/**
 * Sticky site header. The server layout resolves the session and the category
 * list once, then hands plain data to this client component.
 */
export function SiteHeader({
  user,
  categories = [],
  searchEnabled = true,
}: {
  user: HeaderUser | null;
  categories?: HeaderCategory[];
  searchEnabled?: boolean;
}) {
  const t = useTranslations("nav");


  const links: NavLink[] = [
    { href: "/", label: t("home") },
    { href: "/books", label: t("books") },
    { href: { pathname: "/books", query: NEWEST }, label: t("newReleases") },
    { href: { pathname: "/books", query: BESTSELLING }, label: t("bestsellers") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    { href: "/faq", label: t("faq") },
  ];

  const categoryLinks: NavLink[] = categories.map((category) => ({
    href: { pathname: "/books", query: { category: category.slug } },
    label: category.name,
  }));

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-50 border-b backdrop-blur-md">
      <a
        href="#main"
        className="bg-brand text-brand-foreground sr-only rounded-md px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-100"
      >
        {t("home")}
      </a>

      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <MobileNav links={links} user={user} categoryLinks={categoryLinks} />

        <Link
          href="/"
          className="me-2 flex items-center rounded-md"
          aria-label="Lumen Books"
        >
          <Logo />
        </Link>

        {searchEnabled ? (
          <>
            <SearchDialog />
            <SearchTrigger />
          </>
        ) : null}

        <nav aria-label="Main" className="ms-2 hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {links.slice(0, 3).map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {categoryLinks.length > 0 ? (
              <li>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="text-muted-foreground hover:text-foreground h-9 gap-1 px-3 text-sm font-medium"
                    data-slot="dropdown-menu-trigger"
                  >
                    {t("categories")}
                    <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {categoryLinks.map((link) => (
                      <DropdownMenuItem key={link.label} asChild>
                        <Link href={link.href}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ) : null}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-0.5">
          <LocaleSwitcher />
          <ThemeToggle />
          <CartButton />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Button asChild size="sm" className="ms-2 hidden h-9 sm:inline-flex">
              <Link href="/auth/sign-in">{t("signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}