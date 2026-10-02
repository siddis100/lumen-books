import { Package, Receipt, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/layout";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getAccountOrders, getAccountStats, getLibrary } from "@/lib/account";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/**
 * Account overview: three counters plus the most recent orders.
 *
 * Orders bought as a guest are attached to the account during sign-in
 * (`claimGuestOrders`), so a customer's history is complete on first visit.
 */
export async function AccountOverview({ locale }: { locale: Locale }) {
  const user = await requireUser();
  const [stats, orderList, library] = await Promise.all([
    getAccountStats(user.id),
    getAccountOrders(user.id, 5),
    getLibrary(user.id),
  ]);

  const t = await getTranslations({ locale, namespace: "account" });

  const cards = [
    { label: t("overview.orders"), value: String(stats.orderCount), icon: Receipt },
    { label: t("overview.books"), value: String(library.length), icon: Package },
    { label: t("overview.spent"), value: formatPrice(stats.spentCents), icon: Wallet },
  ];

  return (
    <div className="space-y-10">
      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label} className="bg-card border-border/70 rounded-xl border p-5">
            <card.icon className="text-brand size-5" aria-hidden />
            <p className="font-display mt-3 text-2xl font-semibold tabular-nums">{card.value}</p>
            <p className="text-muted-foreground mt-1 text-sm">{card.label}</p>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="font-display text-lg font-semibold">{t("overview.recent")}</h2>

        {orderList.length === 0 ? (
          <div className="mt-4">
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
          <ul className="mt-4 space-y-3">
            {orderList.map((order) => (
              <li key={order.id} className="bg-card border-border/70 rounded-xl border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-medium tabular-nums" dir="ltr">
                    {order.orderNumber}
                  </p>
                  <p className="text-muted-foreground text-sm">{t(`status.${order.status}`)}</p>
                </div>
                <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{formatDate(order.createdAt, locale)}</span>
                  <span>
                    {order.items.length} · {t("orders.items")}
                  </span>
                  <span className="text-foreground font-medium">{formatPrice(order.totalCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}