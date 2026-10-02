import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReviewRow } from "@/components/admin/review-row";
import { getAdminReviews } from "@/lib/admin/queries";
import type { ReviewStatus } from "@/lib/db/schema";
import { routing, type Locale } from "@/i18n/routing";

const FILTERS = ["pending", "approved", "rejected"] as const;

/** Review moderation queue; the pending tab is the default landing view. */
export default async function AdminReviewsPage({
  params,
  searchParams,
}: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { status } = await searchParams;
  const active = FILTERS.includes((status ?? "pending") as (typeof FILTERS)[number])
    ? ((status ?? "pending") as ReviewStatus)
    : "pending";

  const t = await getTranslations({ locale, namespace: "admin.reviews" });
  const ta = await getTranslations({ locale, namespace: "admin.actions" });

  const reviews = await getAdminReviews(active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <nav aria-label={ta("filter")} className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <a
            key={value}
            href={`/${locale}/admin/reviews?status=${value}`}
            aria-current={active === value ? "page" : undefined}
            className={
              active === value
                ? "bg-brand text-brand-foreground rounded-lg px-3 py-1.5 text-sm font-medium"
                : "bg-card border-border/70 hover:border-brand/40 rounded-lg border px-3 py-1.5 text-sm font-medium"
            }
          >
            {t(value)}
          </a>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map(({ review, bookTitle, bookSlug }) => (
            <ReviewRow
              key={review.id}
              locale={locale}
              bookTitle={bookTitle}
              bookSlug={bookSlug}
              review={{
                id: review.id,
                status: review.status,
                authorName: review.authorName,
                rating: review.rating,
                title: review.title,
                body: review.body,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}