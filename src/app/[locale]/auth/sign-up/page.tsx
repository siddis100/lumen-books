import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getSessionUser } from "@/lib/auth";
import { localeAlternates, localeUrl } from "@/lib/seo";
import { routing, type Locale } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("signUpTitle"),
    description: t("signUpSubtitle"),
    robots: { index: false, follow: true },
    alternates: {
      canonical: localeUrl(locale, "/auth/sign-up"),
      languages: localeAlternates("/auth/sign-up"),
    },
  };
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (user) redirect(`/${locale}/account`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tb = await getTranslations({ locale, namespace: "auth.benefits" });

  return (
    <AuthShell
      title={t("signUpTitle")}
      subtitle={t("signUpSubtitle")}
      benefitsTitle={tb("title")}
      benefits={[tb("library"), tb("redownload"), tb("reviews")]}
      footer={
        <p className="text-muted-foreground text-sm">
          {t("haveAccount")}{" "}
          <a
            href={`/${locale}/auth/sign-in`}
            className="text-brand font-medium underline underline-offset-4"
          >
            {t("signIn")}
          </a>
        </p>
      }
    >
      <SignUpForm locale={locale} next={next} />
    </AuthShell>
  );
}