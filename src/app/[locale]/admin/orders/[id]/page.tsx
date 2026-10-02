import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrderStatusForm } from "@/components/admin/order-status-form";
import { Badge } from "@/components/ui/badge";
import { coverUrl } from "@/lib/storage-url";
import { getAdminOrderDetail } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routing, type Locale } from "@/i18n/routing";

/** One order in full: items, PayPal identifiers, webhook state and overrides. */
export default async function AdminOrderDetailPage({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.orders" });
  const tStatus = await getTranslations({ locale, namespace: "account.status" });

  const detail = await getAdminOrderDetail(id);
  if (!detail) notFound();
  const { order, items } = detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display font-mono text-2xl font-semibold">{order.orderNumber}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{formatDateTime(order.createdAt, locale)}</p>
        </div>
        <Badge variant={order.status === "paid" ? "default" : "secondary"}>{tStatus(order.status)}</Badge>
      </div>

      <dl className="bg-card border-border/70 grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("email")}</dt>
          <dd className="text-sm" dir="ltr">{order.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("transactionId")}</dt>
          <dd className="font-mono text-xs" dir="ltr">{order.paypalCaptureId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("paypalStatus")}</dt>
          <dd className="text-sm" dir="ltr">{order.paypalStatus ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("webhook")}</dt>
          <dd className="text-sm">
            {order.webhookConfirmedAt
              ? `${t("webhookConfirmed")} · ${formatDateTime(order.webhookConfirmedAt, locale)}`
              : t("webhookPending")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("date")}</dt>
          <dd className="text-sm">{order.paidAt ? formatDateTime(order.paidAt, locale) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">{t("total")}</dt>
          <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
        </div>
      </dl>

      <section className="bg-card border-border/70 overflow-x-auto rounded-xl border p-5">
        <h3 className="font-display text-lg font-semibold">{t("items")}</h3>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl(item.coverPathSnapshot)}
                alt=""
                width={32}
                height={48}
                className="h-12 w-8 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.titleSnapshot}</p>
                <p className="text-muted-foreground text-xs">{item.authorSnapshot}</p>
              </div>
              <span className="text-muted-foreground text-sm tabular-nums">×{item.quantity}</span>
              <span className="w-24 text-right text-sm tabular-nums">{formatPrice(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card border-border/70 rounded-xl border p-5">
        <h3 className="font-display text-lg font-semibold">{t("updateStatus")}</h3>
        <div className="mt-4">
          <OrderStatusForm
            orderId={order.id}
            locale={locale}
            status={order.status}
            note={order.adminNote}
            webhookConfirmed={order.webhookConfirmedAt !== null}
          />
        </div>
      </section>
    </div>
  );
}