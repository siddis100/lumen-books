import { AuthMessage } from "@/components/auth/auth-message";
import { Container, Section } from "@/components/common/layout";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Landing page for `/[locale]/auth/*`: a simple index of the auth flows so the
 * section is never a 404.
 */
export default async function AuthIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  const links = [
    { href: `/${locale}/auth/sign-in`, label: t("signIn") },
    { href: `/${locale}/auth/sign-up`, label: t("signUp") },
    { href: `/${locale}/auth/forgot-password`, label: t("forgotPassword") },
  ];

  return (
    <Section>
      <Container className="max-w-md">
        <h1 className="font-display text-2xl font-semibold">{t("metaTitle")}</h1>
        <ul className="mt-6 space-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <a className="text-brand underline underline-offset-4" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <AuthMessage tone="info" className="mt-8">
          {t("checkEmailBody")}
        </AuthMessage>
      </Container>
    </Section>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}