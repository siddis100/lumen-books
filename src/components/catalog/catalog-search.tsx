"use client";

import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

/**
 * Inline search field for the catalogue.
 * `nuqs` owns the value: it is written to the URL (replace history, throttled)
 * so results stay shareable and the back button still works.
 */
export function CatalogSearch({ placeholder, className }: { placeholder: string; className?: string }) {
  const t = useTranslations("catalog");
  const [isPending, setIsPending] = useState(false);
  const [value, setValue] = useQueryState("q", {
    defaultValue: "",
    clearOnDefault: true,
    throttleMs: 400,
    history: "replace",
  });

  return (
    <div role="search" className={`relative ${className ?? ""}`}>
      <label htmlFor="catalog-search" className="sr-only">
        {t("searchPlaceholder")}
      </label>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
      />
      <input
        id="catalog-search"
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setIsPending(true);
          setValue(event.target.value);
        }}
        onBlur={() => setIsPending(false)}
        placeholder={placeholder}
        autoComplete="off"
        className="border-border bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border ps-9 pe-10 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {isPending ? (
        <Loader2
          aria-hidden="true"
          className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md transition-colors"
          aria-label={t("resetFilters")}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}