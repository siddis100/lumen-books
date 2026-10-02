import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProfileForm } from "@/components/account/profile-form";
import { getAccountProfile, getAccountStats } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
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
  const t = await getTranslations({ locale, namespace: "account.profile" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/account/profile"),
      languages: localeAlternates("/account/profile"),
    },
  };
}

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const [profile, stats] = await Promise.all([getAccountProfile(user.id), getAccountStats(user.id)]);
  const t = await getTranslations({ locale, namespace: "account.profile" });

  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{t("title")}</h2>

      <div className="mt-6">
        <ProfileForm
          locale={locale}
          fullName={profile?.fullName ?? user.fullName ?? ""}
          email={profile?.email ?? user.email}
        />
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="bg-card border-border/70 rounded-xl border p-4">
          <dt className="text-muted-foreground text-xs">{t("memberSince")}</dt>
          <dd className="mt-1 text-sm font-medium">
            {profile ? formatDate(profile.createdAt, locale) : "—"}
          </dd>
        </div>
        <div className="bg-card border-border/70 rounded-xl border p-4">
          <dt className="text-muted-foreground text-xs">{t("orders")}</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums">{stats.orderCount}</dd>
        </div>
      </dl>
    </section>
  );
}