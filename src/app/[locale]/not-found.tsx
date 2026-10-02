import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BookOpen, Home, Search } from "lucide-react";
import { Container } from "@/components/common/layout";
import { Button } from "@/components/ui/button";

/**
 * Locale-aware 404. `notFound()` inside `src/app/[locale]` renders this file so
 * a wrong URL keeps the visitor inside their language and inside the design.
 */
export default async function LocaleNotFound() {
  const [t, locale] = await Promise.all([
    getTranslations(),
    // A missing or invalid locale must never throw on an error page.
    getLocale().catch(() => "en" as const),
  ]);

  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <BookOpen className="text-brand size-10" aria-hidden="true" />
      <p className="font-display text-brand mt-6 text-6xl font-bold">404</p>
      <h1 className="font-display mt-3 text-2xl font-semibold text-balance sm:text-3xl">
        {t("common.notFoundTitle")}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-pretty">{t("common.notFoundBody")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" className="h-11">
          <Link href={`/${locale}`}>
            <Home className="size-4 rtl-flip" aria-hidden="true" />
            {t("common.backHome")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11">
          <Link href={`/${locale}/books`}>
            <Search className="size-4 rtl-flip" aria-hidden="true" />
            {t("nav.books")}
          </Link>
        </Button>
      </div>
    </Container>
  );
}