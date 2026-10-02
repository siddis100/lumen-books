import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
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
    title: t("forgotPassword"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/auth/forgot-password"),
      languages: localeAlternates("/auth/forgot-password"),
    },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tb = await getTranslations({ locale, namespace: "auth.benefits" });

  return (
    <AuthShell
      title={t("forgotPassword")}
      subtitle={t("resetSent")}
      benefitsTitle={tb("title")}
      benefits={[tb("library"), tb("redownload"), tb("reviews")]}
      footer={
        <p className="text-muted-foreground text-sm">
          <a
            href={`/${locale}/auth/sign-in`}
            className="text-brand font-medium underline underline-offset-4"
          >
            {t("signIn")}
          </a>
        </p>
      }
    >
      <ForgotPasswordForm locale={locale} />
    </AuthShell>
  );
}