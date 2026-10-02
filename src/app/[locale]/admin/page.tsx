import type { LucideIcon } from "lucide-react";
import { BookOpen, CircleDollarSign, Clock, Package, Receipt, Users } from "lucide-react";
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
import {
  getDashboardStats,
  getRecentOrders,
  getSalesSeries,
  getTopBooks,
} from "@/lib/admin/queries";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routing, type Locale } from "@/i18n/routing";

/** Admin dashboard: revenue, sales curve, best sellers and the latest orders. */
export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "admin.dashboard" });
  const tStatus = await getTranslations({ locale, namespace: "account.status" });

  const [stats, series, topBooks, recentOrders] = await Promise.all([
    getDashboardStats(),
    getSalesSeries(30),
    getTopBooks(5),
    getRecentOrders(8),
  ]);

  const cards: { label: string; value: string; icon: LucideIcon }[] = [
    { label: t("revenue"), value: formatPrice(stats.revenueCents), icon: CircleDollarSign },
    { label: t("orders"), value: String(stats.orderCount), icon: Receipt },
    { label: t("books"), value: String(stats.bookCount), icon: BookOpen },
    { label: t("customers"), value: String(stats.customerCount), icon: Users },
    { label: t("avgOrder"), value: formatPrice(stats.avgOrderCents), icon: Package },
    { label: t("pending"), value: String(stats.pendingCount), icon: Clock },
  ];

  const peak = Math.max(...series.map((point) => point.cents), 1);

  return (
    <div className="space-y-8">
      {stats.demoCount > 0 ? (
        <p className="bg-warning/10 text-warning-foreground border-warning/30 rounded-lg border px-4 py-3 text-sm">
          {t("demoNotice")}
        </p>
      ) : null}

      <section aria-label={t("title")}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.label} className="bg-card border-border/70 rounded-xl border p-5">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <card.icon className="size-4" aria-hidden />
                {card.label}
              </div>
              <p className="font-display mt-2 text-2xl font-semibold">{card.value}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={t("salesChart")} className="bg-card border-border/70 rounded-xl border p-5">
        <h2 className="font-display text-lg font-semibold">{t("salesChart")}</h2>
        <div className="mt-4 flex h-40 items-end gap-0.5" role="img" aria-label={t("salesChart")}>
          {series.map((point) => (
            <div
              key={point.date}
              className="bg-brand/70 hover:bg-brand min-w-0 flex-1 rounded-t"
              style={{ height: `${Math.max((point.cents / peak) * 100, 2)}%` }}
              title={`${point.date}: ${formatPrice(point.cents)}`}
            />
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {series[0]?.date} → {series[series.length - 1]?.date}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label={t("topBooks")} className="bg-card border-border/70 rounded-xl border p-5">
          <h2 className="font-display text-lg font-semibold">{t("topBooks")}</h2>
          {topBooks.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">{t("paid")}: 0</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topBooks.map((book) => (
                <li key={book.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{book.title}</span>
                    <span className="text-muted-foreground"> — {book.author}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {book.units} · {formatPrice(Number(book.revenue))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label={t("recentOrders")} className="bg-card border-border/70 rounded-xl border p-5">
          <h2 className="font-display text-lg font-semibold">{t("recentOrders")}</h2>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">—</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 text-sm">
                  <a
                    href={`/${locale}/admin/orders/${order.id}`}
                    className="hover:underline min-w-0 truncate font-mono text-xs"
                  >
                    {order.orderNumber}
                  </a>
                  <span className="text-muted-foreground shrink-0">{formatDate(order.createdAt, locale)}</span>
                  <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                    {tStatus(order.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label={t("recentOrders")} className="bg-card border-border/70 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orders")}</TableHead>
              <TableHead>{t("customers")}</TableHead>
              <TableHead className="text-right">{t("revenue")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  <a href={`/${locale}/admin/orders/${order.id}`} className="hover:underline">
                    {order.orderNumber}
                  </a>
                </TableCell>
                <TableCell className="text-sm">{order.email}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPrice(order.totalCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}