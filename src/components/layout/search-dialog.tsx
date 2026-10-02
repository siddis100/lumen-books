"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RatingStars } from "@/components/common/rating-stars";
import { formatPrice } from "@/lib/money";
import { coverUrl } from "@/lib/storage-url";

type Hit = {
  id: string;
  slug: string;
  title: string;
  author: string;
  priceCents: number;
  coverPath: string | null;
  ratingAvg: number;
  ratingCount: number;
};

/**
 * Command-palette style search. Results are fetched from the server API route,
 * which is the only place where the query is validated and rate-limited.
 */
export function SearchDialog() {
  const t = useTranslations("nav");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  // Term the current `hits` were fetched for. Comparing it to the live query
  // derives the spinner, so a keystroke never writes state synchronously.
  const [settledTerm, setSettledTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const loading = term.length >= 2 && settledTerm !== term;

  // ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced server search. The reset for a too-short term is deferred with
  // the rest of the work: writing state in the synchronous effect body would
  // trigger a cascading render on every keystroke.
  useEffect(() => {
    if (term.length < 2) {
      const timer = setTimeout(() => {
        setHits([]);
        setSettledTerm("");
      }, 0);
      return () => clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { results: Hit[] };
          setHits(data.results);
        } else {
          setHits([]);
        }
      } catch {
        /* aborted or offline — keep the previous results */
      } finally {
        setSettledTerm(term);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl top-[12%] p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("search")}</DialogTitle>
        </DialogHeader>
        <form
          action={`/${locale}/books`}
          onSubmit={() => setOpen(false)}
          className="flex items-center gap-2 border-b px-4"
        >
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <Input
            ref={inputRef}
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-13 border-0 bg-transparent px-1 focus-visible:ring-0"
          />
          {loading ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
        </form>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {query.trim().length >= 2 ? tCatalog("noResults") : tCatalog("searchHint")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={`/books/${hit.slug}`}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="hover:bg-muted flex items-center gap-3 rounded-lg p-2 transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrl(hit.coverPath)}
                      alt=""
                      width={40}
                      height={56}
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded object-cover shadow-sm"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{hit.title}</span>
                      <span className="text-muted-foreground truncate text-xs">{hit.author}</span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <RatingStars value={hit.ratingAvg} size="xs" />
                        <span className="text-xs font-semibold tabular-nums">
                          {formatPrice(hit.priceCents)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small header button that opens the palette. */
export function SearchTrigger({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true });
        document.dispatchEvent(event);
      }}
      className={`text-muted-foreground hidden h-9 w-56 justify-start gap-2 font-normal lg:inline-flex ${className ?? ""}`}
    >
      <Search className="size-4" />
      <span className="truncate text-sm">{t("searchPlaceholder")}</span>
      <kbd className="bg-muted text-muted-foreground ms-auto rounded border px-1.5 py-0.5 text-[10px] font-medium">
        ⌘K
      </kbd>
    </Button>
  );
}