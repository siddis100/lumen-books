import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Globe, Mail } from "lucide-react";
import { Container, Section } from "@/components/common/layout";
import { PageHero } from "@/components/common/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";
import { routing, type Locale } from "@/i18n/routing";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { contactEmail } from "@/lib/env";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: localeUrl(locale, "/contact"), languages: localeAlternates("/contact") },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  const email = contactEmail();

  return (
    <>
      <PageHero
        locale={locale}
        eyebrow={tn("contact")}
        title={t("title")}
        lede={t("lede")}
        breadcrumbs={[{ label: tn("home"), href: "/" }, { label: t("metaTitle") }]}
      />

      <Section>
        <Container className="grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <div className="max-w-2xl">
            <ContactForm
              labels={{
                name: t("form.name"),
                email: t("form.email"),
                order: t("form.order"),
                subject: t("form.subject"),
                message: t("form.message"),
                submit: t("form.submit"),
                sending: t("form.sending"),
                success: t("form.success"),
                error: t("form.error"),
              }}
            />
          </div>

          <aside className="flex flex-col gap-6">
            <div className="bg-muted/40 rounded-2xl border p-6">
              <h2 className="font-display text-lg font-semibold">{t("channels.title")}</h2>
              <ul className="mt-4 flex flex-col gap-4 text-sm">
                <li className="flex items-start gap-3">
                  <Mail className="text-brand mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="text-muted-foreground block text-xs">{t("channels.email")}</span>
                    <a href={`mailto:${email}`} className="hover:text-brand font-medium underline-offset-4 hover:underline">
                      {email}
                    </a>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="text-brand mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="text-muted-foreground block text-xs">{t("channels.responseTime")}</span>
                    <span className="font-medium">{t("channels.responseTimeValue")}</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Globe className="text-brand mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="text-muted-foreground block text-xs">{t("channels.hours")}</span>
                    <span className="font-medium">{t("channels.hoursValue")}</span>
                    <span className="text-muted-foreground mt-1 block text-xs">{t("channels.languagesValue")}</span>
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </Container>
      </Section>
    </>
  );
}