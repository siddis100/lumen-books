"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateOrderStatusAction, updateOrderNoteAction } from "@/app/actions/admin/orders";

const STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

type Props = {
  orderId: string;
  locale: string;
  status: string;
  note: string | null;
  webhookConfirmed: boolean;
};

/**
 * Status change + internal note for one order.
 *
 * Setting `paid` here is an operational override for a payment PayPal
 * confirmed but the webhook never delivered. It deliberately does NOT call
 * PayPal: no money moves, and the order simply becomes deliverable.
 */
export function OrderStatusForm({ orderId, locale, status, note, webhookConfirmed }: Props) {
  const t = useTranslations("admin.orders");
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(status);
  const [saved, setSaved] = useState(false);

  function update(next: string) {
    setSelected(next);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, next, locale);
      if (result.ok) setSaved(true);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selected} onValueChange={update} disabled={pending}>
          <SelectTrigger className="w-52" aria-label={t("updateStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {saved ? <span className="text-muted-foreground text-sm">{t("update")}</span> : null}
        {!webhookConfirmed ? (
          <span className="text-muted-foreground text-sm">{t("webhookPending")}</span>
        ) : null}
      </div>

      <form
        action={(formData) => {
          const value = String(formData.get("note") ?? "");
          startTransition(async () => {
            await updateOrderNoteAction(orderId, value, locale);
            setSaved(true);
          });
        }}
      >
        <label htmlFor="note" className="text-sm font-medium">
          {t("note")}
        </label>
        <Textarea id="note" name="note" rows={3} defaultValue={note ?? ""} className="mt-1" />
        <button
          type="submit"
          disabled={pending}
          className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-2 text-sm font-medium disabled:opacity-60"
        >
          {t("update")}
        </button>
      </form>
    </div>
  );
}