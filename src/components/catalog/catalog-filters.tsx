"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DualRangeSlider } from "@/components/ui/dual-range-slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/money";
import type { CatalogSort } from "@/lib/queries/catalog";

export type CatalogFilterCategory = { slug: string; name: string; count?: number };
export type CatalogFilterLanguage = { code: string; label: string };

/**
 * Explicit label keys instead of deriving them from the sort value: the
 * translation keys are not mechanical (`relevance` -> `sortFeatured`,
 * `bestselling` -> `sortBestSelling`), so a computed key rendered a raw
 * `catalog.sortRelevance` to the customer and threw a MISSING_MESSAGE.
 */
const SORT_OPTIONS: { value: CatalogSort; labelKey: string }[] = [
  { value: "relevance", labelKey: "sortFeatured" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "oldest", labelKey: "sortOldest" },
  { value: "bestselling", labelKey: "sortBestSelling" },
  { value: "price-asc", labelKey: "sortPriceAsc" },
  { value: "price-desc", labelKey: "sortPriceDesc" },
  { value: "rating", labelKey: "sortRating" },
];

/**
 * All catalogue filters. Each control writes straight into the URL query
 * string, and the server re-runs the query — the browser never decides what a
 * book costs or whether it exists.
 */
export function CatalogFilters({
  categories,
  languages,
  priceBounds,
  className,
}: {
  categories: CatalogFilterCategory[];
  languages: CatalogFilterLanguage[];
  priceBounds: { minCents: number; maxCents: number };
  className?: string;
}) {
  const t = useTranslations("catalog");

  const [params, setParams] = useQueryStates(
    {
      category: parseAsString,
      language: parseAsString,
      // URL values are whole dollars; the server converts to cents.
      minPrice: parseAsInteger,
      maxPrice: parseAsInteger,
      sort: parseAsString,
    },
    { history: "push", clearOnDefault: true },
  );

  // Fall back to the catalogue bounds so the slider always spans real prices.
  const min = Math.max(0, Math.floor(priceBounds.minCents / 100));
  const max = Math.max(min + 5, Math.ceil(priceBounds.maxCents / 100));
  const currentMin = params.minPrice ?? min;
  const currentMax = params.maxPrice ?? max;
  const isDirty = Boolean(params.category || params.language || params.minPrice || params.maxPrice);

  const reset = () =>
    setParams({ category: null, language: null, minPrice: null, maxPrice: null });

  return (
    <div className={`bg-card flex flex-col gap-6 rounded-2xl border p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="text-brand size-4" aria-hidden="true" />
          {t("filters")}
        </p>
        {isDirty ? (
          <Button variant="ghost" size="sm" onClick={reset} className="text-brand h-7">
            {t("resetFilters")}
          </Button>
        ) : null}
      </div>

      {/* Category */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          {t("category")}
        </legend>
        <div className="flex flex-col gap-1.5">
          <CategoryRow
            id="cat-all"
            label={t("allCategories")}
            checked={!params.category}
            onSelect={() => setParams({ category: null })}
          />
          {categories.map((category) => (
            <CategoryRow
              key={category.slug}
              id={`cat-${category.slug}`}
              label={category.name}
              count={category.count}
              checked={params.category === category.slug}
              onSelect={() =>
                setParams({ category: params.category === category.slug ? null : category.slug })
              }
            />
          ))}
        </div>
      </fieldset>

      {/* Language */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-language" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("language")}
        </Label>
        <Select
          value={params.language ?? "all"}
          onValueChange={(value) => setParams({ language: value === "all" ? null : value })}
        >
          <SelectTrigger id="filter-language" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allLanguages")}</SelectItem>
            {languages.map((language) => (
              <SelectItem key={language.code} value={language.code}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          {t("priceRange")}
        </legend>
        <DualRangeSlider
          min={min}
          max={max}
          step={1}
          value={[currentMin, currentMax]}
          label={t("priceRange")}
          onValueChange={([low, high]) =>
            setParams({
              minPrice: low <= min ? null : low,
              maxPrice: high >= max ? null : high,
            })
          }
        />
        <div className="text-muted-foreground flex items-center justify-between text-xs font-medium tabular-nums">
          <span>{formatPrice(currentMin * 100)}</span>
          <span>{formatPrice(currentMax * 100)}</span>
        </div>
      </fieldset>

      {/* Sort */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="filter-sort" className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {t("sort")}
        </Label>
        <Select
          value={params.sort ?? "relevance"}
          onValueChange={(value) => setParams({ sort: value as CatalogSort })}
        >
          <SelectTrigger id="filter-sort" className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CategoryRow({
  id,
  label,
  count,
  checked,
  onSelect,
}: {
  id: string;
  label: string;
  count?: number;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/60 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onSelect} className="size-4" />
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" ? (
        <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      ) : null}
    </label>
  );
}