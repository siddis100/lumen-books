import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Container } from "@/components/common/layout";
import { routing, type Locale } from "@/i18n/routing";

export type Crumb = { label: string; href?: string };

/**
 * Shared hero for the static pages (about, contact, FAQ, legal).
 * Keeps the vertical rhythm identical from one page to the next.
 */
export function PageHero({
  locale,
  eyebrow,
  title,
  lede,
  breadcrumbs = [],
  children,
}: {
  locale: Locale;
  eyebrow?: string;
  title: string;
  lede?: string;
  breadcrumbs?: Crumb[];
  children?: React.ReactNode;
}) {
  return (
    <header className="border-border/60 bg-muted/30 border-b">
      <Container className="pt-8 pb-12 sm:pt-10 sm:pb-16">
        {breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="text-muted-foreground mb-6 flex flex-wrap items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3 rtl-flip" aria-hidden="true" /> : null}
                {crumb.href ? (
                  <Link href={`/${locale}${crumb.href}`} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        {eyebrow ? (
          <p className="text-brand mb-3 text-xs font-semibold tracking-[0.18em] uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-display max-w-3xl text-3xl leading-tight font-semibold text-balance sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {lede ? <p className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">{lede}</p> : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </Container>
    </header>
  );
}

export function pageAlternates(locale: Locale, path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    canonical: `${base}/${locale}${path}`,
    languages: Object.fromEntries(
      routing.locales.map((code) => [code, `${base}/${code}${path}`]),
    ),
  };
}
