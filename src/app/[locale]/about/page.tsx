import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Award, Heart, Library, Scale } from "lucide-react";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { hasAnyDemoBooks } from "@/lib/queries/demo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: localeUrl(locale, "/about"), languages: localeAlternates("/about") },
  };
}

const VALUE_ICONS = [Heart, Scale, Award, Library] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const isDemo = await hasAnyDemoBooks();

  const values = t.raw("values.items") as Record<
    string,
    { title: string; description: string }
  >;
  const order = ["curation", "fairness", "access", "ownership"];

  const stats = [
    { value: isDemo ? "—" : "60+", label: t("stats.titles") },
    { value: isDemo ? "—" : "40+", label: t("stats.authors") },
    { value: isDemo ? "—" : "80+", label: t("stats.countries") },
    { value: "EN · FR · AR", label: t("stats.languages") },
  ];

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={tn("about")}
        title={t("title")}
        lede={t("lede")}
        breadcrumbs={[{ label: tn("home"), href: "/" }, { label: t("metaTitle") }]}
      />

      <Section>
        <Container className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t("story.title")}</h2>
            <div className="prose-lb mt-4 flex flex-col gap-4">
              <p>{t("story.p1")}</p>
              <p>{t("story.p2")}</p>
              <p>{t("story.p3")}</p>
            </div>
          </div>

          <aside className="bg-muted/40 h-fit rounded-2xl border p-6">
            <h3 className="font-display text-lg font-semibold">{t("stats.title")}</h3>
            <dl className="mt-4 flex flex-col gap-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                  <dd className="font-display text-2xl font-bold tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </Container>
      </Section>

      <Section className="border-border/60 border-t">
        <Container>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t("values.title")}</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {order.map((key, index) => {
              const Icon = VALUE_ICONS[index] ?? Heart;
              const value = values[key];
              if (!value) return null;
              return (
                <li key={key} className="bg-card rounded-2xl border p-6">
                  <Icon className="text-brand size-6" aria-hidden="true" />
                  <h3 className="font-display mt-4 text-lg font-semibold">{value.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm text-pretty">{value.description}</p>
                </li>
              );
            })}
          </ul>
        </Container>
      </Section>

      <Section className="bg-brand/5 border-border/60 border-t">
        <Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-semibold">{t("cta.title")}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{t("cta.subtitle")}</p>
          </div>
          <Button asChild size="lg" className="h-11 shrink-0">
            <Link href="/books">{tn("books")}</Link>
          </Button>
        </Container>
      </Section>
    </>
  );
}