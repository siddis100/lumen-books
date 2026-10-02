"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { AuthMessage } from "@/components/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createPromoAction,
  deletePromoAction,
  togglePromoActiveAction,
  updatePromoAction,
} from "@/app/actions/admin/promos";

type Promo = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
};

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`, not an ISO string with a Z. */
const toLocalInput = (date: Date | null) => {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function PromoManager({ locale, promos }: { locale: string; promos: Promo[] }) {
  const t = useTranslations("admin.promos");
  const ta = useTranslations("admin.actions");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function submit(formData: FormData, id: string | null) {
    const raw = Object.fromEntries(formData.entries());
    const maxUses = String(raw.maxUses ?? "").trim();
    const values = {
      code: String(raw.code ?? ""),
      kind: String(raw.kind ?? "percent") as "percent" | "fixed",
      value: Number(raw.value ?? 0),
      minSubtotalCents: Math.round(Number(raw.minSubtotal ?? 0) * 100) || 0,
      maxUses: maxUses ? Number(maxUses) : undefined,
      startsAt: String(raw.startsAt ?? ""),
      expiresAt: String(raw.expiresAt ?? ""),
      isActive: formData.has("isActive"),
    };

    startTransition(async () => {
      const result = id ? await updatePromoAction(id, values, locale) : await createPromoAction(values, locale);
      if (result.ok) {
        setFeedback({ tone: "success", text: id ? t("updated") : t("created") });
        setCreating(false);
        setEditing(null);
      } else {
        setFeedback({ tone: "error", text: result.error === "code_taken" ? (result.fields?.code ?? "") : result.error });
      }
    });
  }

  const form = (promo?: Promo) => (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <Label htmlFor={`code-${promo?.id ?? "new"}`}>{t("code")}</Label>
        <Input
          id={`code-${promo?.id ?? "new"}`}
          name="code"
          required
          defaultValue={promo?.code}
          className="uppercase"
        />
      </div>
      <div>
        <Label htmlFor={`kind-${promo?.id ?? "new"}`}>{t("type")}</Label>
        <select
          id={`kind-${promo?.id ?? "new"}`}
          name="kind"
          defaultValue={promo?.kind ?? "percent"}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="percent">{t("typePercent")}</option>
          <option value="fixed">{t("typeFixed")}</option>
        </select>
      </div>
      <div>
        <Label htmlFor={`value-${promo?.id ?? "new"}`}>{t("value")}</Label>
        <Input
          id={`value-${promo?.id ?? "new"}`}
          name="value"
          type="number"
          min={1}
          required
          defaultValue={promo?.value}
        />
      </div>
      <div>
        <Label htmlFor={`minSubtotal-${promo?.id ?? "new"}`}>{t("minSubtotal")}</Label>
        <Input
          id={`minSubtotal-${promo?.id ?? "new"}`}
          name="minSubtotal"
          inputMode="decimal"
          defaultValue={promo ? (promo.minSubtotalCents / 100).toFixed(2) : ""}
        />
      </div>
      <div>
        <Label htmlFor={`maxUses-${promo?.id ?? "new"}`}>{t("maxUses")}</Label>
        <Input
          id={`maxUses-${promo?.id ?? "new"}`}
          name="maxUses"
          type="number"
          min={1}
          defaultValue={promo?.maxUses ? String(promo.maxUses) : ""}
        />
      </div>
      <div className="flex items-end gap-4 pb-1">
        <span className="flex items-center gap-2">
          <Switch id={`isActive-${promo?.id ?? "new"}`} name="isActive" defaultChecked={promo?.isActive ?? true} />
          <Label htmlFor={`isActive-${promo?.id ?? "new"}`}>{t("active")}</Label>
        </span>
      </div>
      <div>
        <Label htmlFor={`startsAt-${promo?.id ?? "new"}`}>{t("startsAt")}</Label>
        <Input
          id={`startsAt-${promo?.id ?? "new"}`}
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalInput(promo?.startsAt ?? null)}
        />
      </div>
      <div>
        <Label htmlFor={`expiresAt-${promo?.id ?? "new"}`}>{t("expiresAt")}</Label>
        <Input
          id={`expiresAt-${promo?.id ?? "new"}`}
          name="expiresAt"
          type="datetime-local"
          defaultValue={toLocalInput(promo?.expiresAt ?? null)}
        />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {ta("save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => (editing ? setEditing(null) : setCreating(false))}
        >
          {ta("cancel")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{t("title")}</h3>
        <Button size="sm" variant="outline" onClick={() => setCreating((value) => !value)}>
          <Plus className="size-4" aria-hidden />
          {t("new")}
        </Button>
      </div>

      {feedback ? <AuthMessage tone={feedback.tone}>{feedback.text}</AuthMessage> : null}

      {creating ? (
        <form className="bg-card border-border/70 rounded-xl border p-5" action={(formData) => submit(formData, null)}>
          {form()}
        </form>
      ) : null}

      {promos.length === 0 ? (
        <p className="text-muted-foreground text-sm">{ta("none")}</p>
      ) : (
        <ul className="space-y-3">
          {promos.map((promo) => (
            <li key={promo.id} className="bg-card border-border/70 rounded-xl border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold">{promo.code}</span>
                  <Badge variant={promo.isActive ? "default" : "secondary"}>
                    {promo.isActive ? t("active") : ta("none")}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {promo.kind === "percent" ? `${promo.value}%` : `$${(promo.value / 100).toFixed(2)}`} ·{" "}
                    {promo.usedCount}
                    {promo.maxUses ? ` / ${promo.maxUses}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        await togglePromoActiveAction(promo.id, locale);
                      })
                    }
                  >
                    {promo.isActive ? ta("none") : t("active")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(editing === promo.id ? null : promo.id)}>
                    {ta("save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("delete")}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deletePromoAction(promo.id, locale);
                        setFeedback(result.ok ? { tone: "success", text: t("deleted") } : { tone: "error", text: result.error });
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>

              {editing === promo.id ? (
                <form className="mt-4 border-t pt-4" action={(formData) => submit(formData, promo.id)}>
                  {form(promo)}
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}