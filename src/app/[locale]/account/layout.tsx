import { Download, LayoutGrid, Receipt, User } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { Container } from "@/components/common/layout";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { routing } from "@/i18n/routing";

// The account area depends on the session cookie, so nothing under it can be
// prerendered: `requireUser()` would throw during `next build`.
export const dynamic = "force-dynamic";

/**
 * Account shell: greeting, four tabs and the sign-out button.
 *
 * Every page below `/[locale]/account` renders inside this layout, so the guard
 * (redirect to sign-in) is written once instead of four times.
 */
export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "account" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/auth/sign-in?next=/${locale}/account`);
  }

  const tabs = [
    { href: `/${locale}/account`, label: t("nav.overview"), icon: LayoutGrid },
    { href: `/${locale}/account/orders`, label: t("nav.orders"), icon: Receipt },
    { href: `/${locale}/account/downloads`, label: t("nav.downloads"), icon: Download },
    { href: `/${locale}/account/profile`, label: t("nav.profile"), icon: User },
  ];

  return (
    <div className="bg-muted/30 min-h-[70vh] py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              {t("greeting", { name: user.fullName ?? user.email })}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm" dir="ltr">
              {user.email}
            </p>
          </div>

          <form action={signOutAction}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="outline" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>

        <nav aria-label={t("title")} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <a
                  href={tab.href}
                  className="bg-card border-border/70 hover:border-brand/40 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8">{children}</div>
      </Container>
    </div>
  );
}