import { CreditCard, Globe, Mail } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/common/layout";
import { Logo } from "@/components/common/logo";
import { FooterSettingsButton } from "@/components/layout/cookie-banner";
import { isRtl, type Locale } from "@/i18n/routing";
import type { HeaderCategory } from "@/components/layout/site-header";

/**
 * Site footer: shop links, information, legal, payment reassurance.
 * Rendered on the server so the legal links are present in the initial HTML.
 */
export async function SiteFooter({ categories = [] }: { categories?: HeaderCategory[] }) {
  const t = await getTranslations("footer");
  const tCookies = await getTranslations("cookies");
  const tNav = await getTranslations("nav");
  const locale = (await getLocale()) as Locale;
  const year = new Date().getFullYear();

  const shopLinks = [
    { href: "/books", label: t("allBooks") },
    { href: { pathname: "/books", query: { sort: "newest" } }, label: t("newReleases") },
    { href: { pathname: "/books", query: { sort: "bestselling" } }, label: t("bestsellers") },
    ...(categories.length > 0
      ? [{ href: "/books", label: t("categories") }]
      : []),
  ];

  const infoLinks = [
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    { href: "/faq", label: t("faq") },
    { href: "/recover", label: t("recover") },
  ];

  const legalLinks = [
    { href: "/legal/terms", label: t("terms") },
    { href: "/legal/privacy", label: t("privacy") },
    { href: "/legal/refund", label: t("refund") },
  ];

  const columnClass = "flex flex-col gap-3";

  return (
    <footer className="bg-muted/40 mt-auto border-t">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex rounded-md">
              <Logo />
            </Link>
            <p className="text-muted-foreground mt-4 max-w-sm text-sm text-pretty">
              {t("tagline")}
            </p>
            <ul className="text-muted-foreground mt-6 flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <CreditCard className="size-4 shrink-0" aria-hidden="true" />
                {t("payments")}
              </li>
              <li className="flex items-center gap-2">
                <Globe className="size-4 shrink-0" aria-hidden="true" />
                {t("currency")}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  {tNav("contact")}
                </Link>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-shop" className={columnClass}>
            <p id="footer-shop" className="font-display text-sm font-semibold">
              {t("shop")}
            </p>
            <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
              {shopLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link href={link.href} className="hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              {categories.slice(0, 4).map((category) => (
                <li key={category.slug}>
                  <Link
                    href={{ pathname: "/books", query: { category: category.slug } }}
                    className="hover:text-foreground transition-colors"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-info" className={columnClass}>
            <p id="footer-info" className="font-display text-sm font-semibold">
              {t("information")}
            </p>
            <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
              {infoLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal" className={columnClass}>
            <p id="footer-legal" className="font-display text-sm font-semibold">
              {t("legal")}
            </p>
            <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <FooterSettingsButton label={t("cookies")}>
                  <p className="text-muted-foreground max-w-sm text-xs text-pretty">
                    {tCookies("body")}
                  </p>
                </FooterSettingsButton>
              </li>
            </ul>
          </nav>
        </div>

        <div
          dir={isRtl(locale) ? "rtl" : "ltr"}
          className="text-muted-foreground mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs sm:flex-row"
        >
          <p>{t("rights", { year })}</p>
          <p className="flex items-center gap-4">
            <span>{t("currency")}</span>
            <span aria-hidden="true" className="text-border">
              ·
            </span>
            <span>USD</span>
          </p>
        </div>
      </Container>
    </footer>
  );
}
