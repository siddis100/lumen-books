import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminOrders } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { OrderStatus } from "@/lib/db/schema";
import { routing, type Locale } from "@/i18n/routing";

const FILTERS = ["", "pending", "paid", "failed", "refunded", "cancelled"] as const;

/** Order list with a status filter carried in the URL so the view is shareable. */
export default async function AdminOrdersPage({
  params,
  searchParams,
}: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { status } = await searchParams;
  const filter = FILTERS.includes((status ?? "") as (typeof FILTERS)[number]) ? ((status || undefined) as OrderStatus | undefined) : undefined;

  const t = await getTranslations({ locale, namespace: "admin.orders" });
  const tActions = await getTranslations({ locale, namespace: "admin.actions" });
  const tStatus = await getTranslations({ locale, namespace: "account.status" });

  const rows = await getAdminOrders(filter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <nav aria-label={tActions("filter")} className="flex flex-wrap gap-2">
        {FILTERS.map((value) => {
          const href = value ? `/${locale}/admin/orders?status=${value}` : `/${locale}/admin/orders`;
          const active = (filter ?? "") === value;
          return (
            <a
              key={value || "all"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "bg-brand text-brand-foreground rounded-lg px-3 py-1.5 text-sm font-medium"
                  : "bg-card border-border/70 hover:border-brand/40 rounded-lg border px-3 py-1.5 text-sm font-medium"
              }
            >
              {value ? tStatus(value) : tActions("all")}
            </a>
          );
        })}
      </nav>

      <div className="bg-card border-border/70 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("number")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-right">{t("items")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("webhook")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">
                  {tActions("none")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ order, items }) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">
                    <a href={`/${locale}/admin/orders/${order.id}`} className="hover:underline">
                      {order.orderNumber}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{order.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateTime(order.createdAt, locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{items}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPrice(order.totalCents)}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                      {tStatus(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {order.webhookConfirmedAt ? (
                      <Badge variant="outline">{t("webhookConfirmed")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("webhookPending")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}