import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { Separator } from "@/components/ui/separator";
import { routing, type Locale } from "@/i18n/routing";
import { contactEmail } from "@/lib/env";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { sellerInfo } from "@/lib/seller";

/** The three legal documents, and the URL segment used for each. */
const DOCS = ["terms", "privacy", "refund"] as const;
type Doc = (typeof DOCS)[number];

/** Frozen at authoring time: the version published with the launch. */
const LAST_UPDATED = "2026-02-15";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DOCS.map((doc) => ({ locale, doc })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; doc: string }>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return { title: "Not found", robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "legal" });
  const doc$ = {
    metaTitle: t(`${doc}.metaTitle`),
    metaDescription: t(`${doc}.metaDescription`),
    title: t(`${doc}.title`),
    lastUpdated: t(`${doc}.lastUpdated`),
    intro: t(`${doc}.intro`),
  };

  return {
    title: doc$.metaTitle,
    description: doc$.metaDescription,
    alternates: { canonical: localeUrl(locale, `/legal/${doc}`), languages: localeAlternates(`/legal/${doc}`) },
  };
}

function isDoc(value: string): value is Doc {
  return (DOCS as readonly string[]).includes(value);
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: Locale; doc: string }>;
}) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "legal" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const format = await getFormatter();
  const doc$ = {
    title: t(`${doc}.title`),
    intro: t(`${doc}.intro`),
    lastUpdated: t(`${doc}.lastUpdated`),
  };
  const contactLine = t("contact", { email: contactEmail() });
  const sections = t.raw(`${doc}.sections`) as { title: string; body: string }[];
  const seller = sellerInfo();
  const details: { label: string; value: string }[] = [];
  if (seller.legalName) details.push({ label: t("seller.legalName"), value: seller.legalName });
  details.push({ label: t("seller.address"), value: seller.address.join(", ") });
  if (seller.registry) details.push({ label: t("seller.registry"), value: seller.registry });
  if (seller.vat) details.push({ label: t("seller.vat"), value: seller.vat });
  if (seller.country) details.push({ label: t("seller.country"), value: seller.country });
  if (seller.governingLaw)
    details.push({ label: t("seller.governingLaw"), value: seller.governingLaw });

  return (
    <>
      <PageHero
        locale={locale}
        title={doc$.title}
        lede={doc$.intro}
        breadcrumbs={[
          { label: tn("home"), href: "/" },
          { label: doc$.title },
        ]}
      />

      <Section>
        <Container className="max-w-3xl">
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            {doc$.lastUpdated.replace("{date}", format.dateTime(new Date(LAST_UPDATED), { dateStyle: "long" }))}
          </p>

          <article className="mt-8 flex flex-col gap-6">
            {sections.map((section, index) => (
              <section key={section.title} className={index > 0 ? "pt-2" : undefined}>
                <h2 className="font-display text-lg font-semibold text-balance">{section.title}</h2>
                <p className="text-muted-foreground mt-2 text-[0.95rem] leading-relaxed text-pretty">{section.body}</p>
              </section>
            ))}
          </article>

          <Separator className="my-10" />
          <div className="space-y-4">
            <h2 className="font-display text-base font-semibold">{t("seller.title")}</h2>
            <p className="text-sm font-semibold">{seller.name}</p>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {details.map((detail) => (
                <div key={detail.label} className="contents">
                  <dt className="text-muted-foreground text-xs">{detail.label}</dt>
                  <dd className="text-sm">{detail.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-sm">{contactLine}</p>
          </div>
        </Container>
      </Section>
    </>
  );
}