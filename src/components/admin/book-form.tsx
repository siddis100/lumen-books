"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AuthMessage } from "@/components/auth/auth-message";
import { createBookAction, updateBookAction, type AdminActionResult } from "@/app/actions/admin/books";
import type { BookFormValues } from "@/lib/schemas";

const LANGUAGES = ["en", "fr", "ar", "es", "de", "pt", "other"] as const;

export type BookFormDefaults = Partial<BookFormValues>;

type Props = {
  locale: string;
  categories: { id: string; name: string }[];
  defaults?: BookFormDefaults;
  bookId?: string;
};

/** Dollars <-> cents: the admin types dollars, the server stores integer cents. */
const toCents = (dollars: string) => {
  const value = Number.parseFloat(dollars);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};
const toDollars = (cents: number | undefined) => (cents ? (cents / 100).toFixed(2) : "");

/** Shared create/edit form for a title. */
export function BookForm({ locale, categories, defaults, bookId }: Props) {
  const t = useTranslations("admin.books");
  const ta = useTranslations("admin.actions");

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [price, setPrice] = useState(() => toDollars(defaults?.priceCents ?? 900));
  const [compareAt, setCompareAt] = useState(() => toDollars(defaults?.compareAtCents));
  const [formats, setFormats] = useState<string[]>(defaults?.formats ?? ["epub", "pdf"]);

  const toggleFormat = (format: string) => {
    setFormats((current) =>
      current.includes(format) ? current.filter((entry) => entry !== format) : [...current, format],
    );
  };

  function onSubmit(formData: FormData) {
    const raw = Object.fromEntries(formData.entries());
    const pages = String(raw.pages ?? "").trim();
    const compareAtCents = compareAt ? toCents(compareAt) : 0;

    const values: BookFormValues = {
      title: String(raw.title ?? ""),
      subtitle: String(raw.subtitle ?? ""),
      author: String(raw.author ?? ""),
      slug: String(raw.slug ?? ""),
      categoryId: String(raw.categoryId ?? ""),
      description: String(raw.description ?? ""),
      excerpt: String(raw.excerpt ?? ""),
      priceCents: toCents(price),
      // Empty optional numbers must be `undefined`, not 0, so the schema's
      // optional branch is taken and the column becomes NULL.
      compareAtCents: compareAtCents > 0 ? compareAtCents : undefined,
      language: String(raw.language ?? "en") as BookFormValues["language"],
      formats: formats as BookFormValues["formats"],
      pages: pages ? Number(pages) : undefined,
      isbn: String(raw.isbn ?? ""),
      publishedAt: String(raw.publishedAt ?? ""),
      // Radix Switch only renders its hidden input when checked, so `has()` is
      // the reliable test.
      isFeatured: formData.has("isFeatured"),
      isActive: formData.has("isActive"),
      isDemo: formData.has("isDemo"),
    };

    startTransition(async () => {
      const result: AdminActionResult = bookId
        ? await updateBookAction(bookId, values, locale)
        : await createBookAction(values, locale);

      if (result.ok) {
        window.location.href = `/${locale}/admin/books`;
        return;
      }
      if (result.error === "slug_taken") {
        setFeedback({ tone: "error", text: result.fields?.slug ?? ta("total") });
        return;
      }
      setFeedback({ tone: "error", text: result.fields?.description ?? result.error });
    });
  }

  return (
    <form action={onSubmit} className="space-y-8">
      {feedback ? <AuthMessage tone={feedback.tone}>{feedback.text}</AuthMessage> : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="font-display mb-2 text-lg font-semibold sm:col-span-2">{t("titleField")}</legend>

        <div className="sm:col-span-2">
          <Label htmlFor="title">{t("titleField")}</Label>
          <Input id="title" name="title" required defaultValue={defaults?.title} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="subtitle">{t("subtitleField")}</Label>
          <Input id="subtitle" name="subtitle" defaultValue={defaults?.subtitle ?? ""} />
        </div>

        <div>
          <Label htmlFor="author">{t("author")}</Label>
          <Input id="author" name="author" required defaultValue={defaults?.author} />
        </div>

        <div>
          <Label htmlFor="slug">{t("slug")}</Label>
          <Input id="slug" name="slug" required defaultValue={defaults?.slug} pattern="[a-z0-9-]+" />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="description">{t("description")}</Label>
          <Textarea id="description" name="description" required rows={6} defaultValue={defaults?.description} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="excerpt">{t("excerpt")}</Label>
          <Textarea id="excerpt" name="excerpt" rows={3} defaultValue={defaults?.excerpt ?? ""} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="font-display mb-2 text-lg font-semibold sm:col-span-3">{t("price")}</legend>

        <div>
          <Label htmlFor="price">{t("price")}</Label>
          <Input id="price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
        </div>

        <div>
          <Label htmlFor="compareAt">{t("compareAtPrice")}</Label>
          <Input id="compareAt" inputMode="decimal" value={compareAt} onChange={(event) => setCompareAt(event.target.value)} />
        </div>

        <div>
          <Label htmlFor="categoryId">{t("category")}</Label>
          {/* Radix Select renders a hidden native select, so `name` reaches FormData. */}
          <Select name="categoryId" defaultValue={defaults?.categoryId ?? ""}>
            <SelectTrigger id="categoryId">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="font-display mb-2 text-lg font-semibold sm:col-span-4">{t("format")}</legend>

        <div>
          <Label htmlFor="language">{t("language")}</Label>
          <Select name="language" defaultValue={defaults?.language ?? "en"}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="pages">{t("pages")}</Label>
          <Input
            id="pages"
            name="pages"
            type="number"
            min={1}
            defaultValue={defaults?.pages ? String(defaults.pages) : ""}
          />
        </div>

        <div>
          <Label htmlFor="isbn">{t("isbn")}</Label>
          <Input id="isbn" name="isbn" defaultValue={defaults?.isbn ?? ""} />
        </div>

        <div>
          <Label htmlFor="publishedAt">{t("publishedAt")}</Label>
          <Input id="publishedAt" name="publishedAt" type="date" defaultValue={defaults?.publishedAt ?? ""} />
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:col-span-4">
          <span className="flex items-center gap-2">
            <Switch id="format-epub" checked={formats.includes("epub")} onCheckedChange={() => toggleFormat("epub")} />
            <Label htmlFor="format-epub">EPUB</Label>
          </span>
          <span className="flex items-center gap-2">
            <Switch id="format-pdf" checked={formats.includes("pdf")} onCheckedChange={() => toggleFormat("pdf")} />
            <Label htmlFor="format-pdf">PDF</Label>
          </span>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="font-display mb-2 text-lg font-semibold sm:col-span-3">{t("status")}</legend>
        <span className="flex items-center gap-2">
          <Switch id="isActive" name="isActive" defaultChecked={defaults?.isActive ?? true} />
          <Label htmlFor="isActive">{t("active")}</Label>
        </span>
        <span className="flex items-center gap-2">
          <Switch id="isFeatured" name="isFeatured" defaultChecked={defaults?.isFeatured ?? false} />
          <Label htmlFor="isFeatured">{t("featured")}</Label>
        </span>
        <span className="flex items-center gap-2">
          <Switch id="isDemo" name="isDemo" defaultChecked={defaults?.isDemo ?? false} />
          <Label htmlFor="isDemo">{t("isDemo")}</Label>
        </span>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || formats.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? ta("saving") : ta("save")}
        </Button>
        <Button asChild variant="ghost">
          <a href={`/${locale}/admin/books`}>{ta("cancel")}</a>
        </Button>
      </div>
    </form>
  );
}