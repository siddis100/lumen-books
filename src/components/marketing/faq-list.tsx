"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

export type FaqEntry = { id: string; question: string; answer: string };

/**
 * Searchable FAQ. Filtering happens in the browser because the list is small,
 * static and already translated — no request needed.
 */
export function FaqList({
  items,
  labels,
}: {
  items: FaqEntry[];
  labels: {
    searchPlaceholder: string;
    noResults: string;
    stillHaveQuestions: string;
    contactUs: string;
  };
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(needle) || item.answer.toLowerCase().includes(needle),
    );
  }, [items, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <label htmlFor="faq-search" className="sr-only">
          {labels.searchPlaceholder}
        </label>
        <Input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="h-11 ps-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-3 rounded-xl border border-dashed p-8 text-sm">
          <HelpCircle className="size-5 shrink-0" aria-hidden="true" />
          {labels.noResults}
        </div>
      ) : (
        <Accordion type="single" collapsible className="w-full">
          {filtered.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-start text-base font-medium">{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="bg-muted/40 flex flex-col items-start justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
        <p className="text-sm font-medium">{labels.stillHaveQuestions}</p>
        <Button asChild variant="outline" size="sm" className="h-9 shrink-0">
          <Link href="/contact">{labels.contactUs}</Link>
        </Button>
      </div>
    </div>
  );
}