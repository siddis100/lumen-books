"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions/admin/categories";

type Category = {
  id: string;
  slug: string;
  nameEn: string;
  nameFr: string | null;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionFr: string | null;
  descriptionAr: string | null;
  position: number;
  bookCount: number;
};

type Props = {
  locale: string;
  categories: Category[];
};

/**
 * Inline create / edit / delete for categories. Each row is its own form so a
 * save only revalidates the categories page, not the whole admin branch.
 */
export function CategoryManager({ locale, categories }: Props) {
  const t = useTranslations("admin.categories");
  const ta = useTranslations("admin.actions");

  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function submit(formData: FormData, id: string | null) {
    const raw = Object.fromEntries(formData.entries());
    const values = {
      slug: String(raw.slug ?? ""),
      nameEn: String(raw.nameEn ?? ""),
      nameFr: String(raw.nameFr ?? ""),
      nameAr: String(raw.nameAr ?? ""),
      descriptionEn: String(raw.descriptionEn ?? ""),
      descriptionFr: String(raw.descriptionFr ?? ""),
      descriptionAr: String(raw.descriptionAr ?? ""),
      position: Number(raw.position ?? 0) || 0,
    };

    startTransition(async () => {
      const result = id ? await updateCategoryAction(id, values, locale) : await createCategoryAction(values, locale);
      if (result.ok) {
        setFeedback({ tone: "success", text: id ? t("updated") : t("created") });
        setEditing(null);
        setCreating(false);
      } else {
        setFeedback({ tone: "error", text: result.error === "slug_taken" ? (result.fields?.slug ?? "") : result.error });
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(id, locale);
      setFeedback(
        result.ok
          ? { tone: "success", text: t("deleted") }
          : { tone: "error", text: result.error },
      );
    });
  }

  const fields = (category?: Category) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`slug-${category?.id ?? "new"}`}>{t("slug")}</Label>
          <Input id={`slug-${category?.id ?? "new"}`} name="slug" required pattern="[a-z0-9-]+" defaultValue={category?.slug} />
        </div>
        <div>
          <Label htmlFor={`position-${category?.id ?? "new"}`}>{t("position")}</Label>
          <Input
            id={`position-${category?.id ?? "new"}`}
            name="position"
            type="number"
            defaultValue={category?.position ?? 0}
          />
        </div>
        <div>
          <Label htmlFor={`nameEn-${category?.id ?? "new"}`}>{t("nameEn")}</Label>
          <Input id={`nameEn-${category?.id ?? "new"}`} name="nameEn" required defaultValue={category?.nameEn} />
        </div>
        <div>
          <Label htmlFor={`nameFr-${category?.id ?? "new"}`}>{t("nameFr")}</Label>
          <Input id={`nameFr-${category?.id ?? "new"}`} name="nameFr" defaultValue={category?.nameFr ?? ""} />
        </div>
        <div>
          <Label htmlFor={`nameAr-${category?.id ?? "new"}`}>{t("nameAr")}</Label>
          <Input id={`nameAr-${category?.id ?? "new"}`} name="nameAr" dir="rtl" defaultValue={category?.nameAr ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`descriptionEn-${category?.id ?? "new"}`}>{t("description")}</Label>
          <Textarea
            id={`descriptionEn-${category?.id ?? "new"}`}
            name="descriptionEn"
            rows={2}
            defaultValue={category?.descriptionEn ?? ""}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {ta("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => (editing ? setEditing(null) : setCreating(false))}>
          {ta("cancel")}
        </Button>
      </div>
    </>
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
          {fields()}
        </form>
      ) : null}

      {categories.length === 0 ? (
        <p className="text-muted-foreground text-sm">{ta("none")}</p>
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => (
            <li key={category.id} className="bg-card border-border/70 rounded-xl border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{category.nameEn}</p>
                  <p className="text-muted-foreground text-xs">
                    /{category.slug} · {category.bookCount}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(editing === category.id ? null : category.id)}>
                    {ta("save")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" aria-label={t("delete")}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{ta("cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(category.id)}>{t("delete")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {editing === category.id ? (
                <form className="mt-4 border-t pt-4" action={(formData) => submit(formData, category.id)}>
                  {fields(category)}
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}