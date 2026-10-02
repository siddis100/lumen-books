import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
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
    title: t("metaTitle"),
    description: t("signInSubtitle"),
    robots: { index: false, follow: true },
    alternates: {
      canonical: localeUrl(locale, "/auth/sign-in"),
      languages: localeAlternates("/auth/sign-in"),
    },
  };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { next, error } = await searchParams;
  setRequestLocale(locale);

  // Already signed in? No reason to show the form.
  const user = await getSessionUser();
  if (user) redirect(`/${locale}/account`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tb = await getTranslations({ locale, namespace: "auth.benefits" });
  const errorCode = error === "invalidCredentials" || error === "generic" ? error : null;

  return (
    <AuthShell
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      benefitsTitle={tb("title")}
      benefits={[tb("library"), tb("redownload"), tb("reviews")]}
      footer={
        <p className="text-muted-foreground text-sm">
          {t("noAccount")}{" "}
          <a href={`/${locale}/auth/sign-up`} className="text-brand font-medium underline underline-offset-4">
            {t("signUp")}
          </a>
        </p>
      }
    >
      {errorCode ? (
        <p className="text-destructive mb-5 text-sm" role="alert">
          {t(`errors.${errorCode}`)}
        </p>
      ) : null}
      <SignInForm locale={locale} next={next} />
    </AuthShell>
  );
}