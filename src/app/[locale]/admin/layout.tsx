import {
  ArrowLeftRight,
  BadgePercent,
  LayoutDashboard,
  MessageSquare,
  Package,
  Store,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/common/layout";
import { getSessionUser } from "@/lib/auth";
import { routing } from "@/i18n/routing";

// The panel reads live data through the service-role layer and is gated on the
// session cookie, so nothing under /admin can be prerendered.
export const dynamic = "force-dynamic";

/** Everything below `/[locale]/admin` inherits the guard written here once. */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "admin" });

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/auth/sign-in?next=/${locale}/admin`);
  }
  if (!user.isAdmin) {
    // Non-admins get a 404 rather than a 403: the panel's existence is not
    // something a random customer should learn.
    notFound();
  }

  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: `/${locale}/admin`, label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: `/${locale}/admin/books`, label: t("nav.books"), icon: Package },
    { href: `/${locale}/admin/categories`, label: t("nav.categories"), icon: ArrowLeftRight },
    { href: `/${locale}/admin/orders`, label: t("nav.orders"), icon: BadgePercent },
    { href: `/${locale}/admin/promos`, label: t("nav.promos"), icon: BadgePercent },
    { href: `/${locale}/admin/reviews`, label: t("nav.reviews"), icon: MessageSquare },
    { href: `/${locale}/admin/import`, label: t("nav.import"), icon: Upload },
  ];

  return (
    <div className="bg-muted/30 min-h-[70vh] py-10 sm:py-14">
      <Container>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-1 text-sm" dir="ltr">
              {user.email}
            </p>
          </div>
          <a
            href={`/${locale}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm font-medium"
          >
            <Store className="size-4" aria-hidden />
            {t("nav.storefront")}
          </a>
        </div>

        <nav aria-label={t("title")} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="bg-card border-border/70 hover:border-brand/40 inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
                >
                  <link.icon className="size-4" aria-hidden />
                  {link.label}
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