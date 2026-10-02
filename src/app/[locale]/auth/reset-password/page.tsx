import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
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
    title: t("resetPassword"),
    // Recovery pages must never be indexed.
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/auth/reset-password"),
      languages: localeAlternates("/auth/reset-password"),
    },
  };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Without a recovery session there is nothing to update: send the visitor
  // back to the sign-in form rather than showing a form that cannot work.
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/auth/sign-in`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const tb = await getTranslations({ locale, namespace: "auth.benefits" });

  return (
    <AuthShell
      title={t("resetPassword")}
      benefitsTitle={tb("title")}
      benefits={[tb("library"), tb("redownload"), tb("reviews")]}
    >
      <ResetPasswordForm locale={locale} />
    </AuthShell>
  );
}