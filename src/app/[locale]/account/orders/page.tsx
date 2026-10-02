import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/common/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getAccountOrders } from "@/lib/account";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { coverUrl } from "@/lib/storage-url";
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
  const t = await getTranslations({ locale, namespace: "account.orders" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: {
      canonical: localeUrl(locale, "/account/orders"),
      languages: localeAlternates("/account/orders"),
    },
  };
}

export default async function AccountOrdersPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  const orderList = await getAccountOrders(user.id);
  const t = await getTranslations({ locale, namespace: "account" });

  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{t("orders.title")}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{t("orders.subtitle")}</p>

      {orderList.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t("orders.none")}
            action={
              <Button asChild variant="outline">
                <a href={`/${locale}/books`}>{t("orders.noneCta")}</a>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orderList.map((order) => {
            const downloadable = order.status === "paid" && Boolean(order.webhookConfirmedAt);
            return (
              <li key={order.id} className="bg-card border-border/70 rounded-xl border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-medium tabular-nums" dir="ltr">
                    {order.orderNumber}
                  </p>
                  <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                    {t(`status.${order.status}`)}
                  </Badge>
                </div>

                <dl className="text-muted-foreground mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt>{t("orders.date")}:</dt>
                    <dd>{formatDate(order.createdAt, locale)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>{t("orders.items")}:</dt>
                    <dd>{order.items.length}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>{t("orders.total")}:</dt>
                    <dd className="text-foreground font-medium">{formatPrice(order.totalCents)}</dd>
                  </div>
                  {order.paypalCaptureId ? (
                    <div className="flex gap-2">
                      <dt>{t("orders.transactionId")}:</dt>
                      <dd className="truncate" dir="ltr">
                        {order.paypalCaptureId}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <ul className="mt-4 space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverUrl(item.coverPath)}
                        alt=""
                        width={40}
                        height={56}
                        loading="lazy"
                        className="h-14 w-10 shrink-0 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="text-muted-foreground truncate text-xs">{item.author}</p>
                      </div>
                      <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
                        × {item.quantity}
                      </p>
                    </li>
                  ))}
                </ul>

                {downloadable ? (
                  <Button asChild size="sm" variant="outline" className="mt-4">
                    <a href={`/${locale}/account/downloads`}>{t("orders.download")}</a>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}