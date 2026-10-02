"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

/**
 * Server-friendly pagination for the catalogue. Links are plain anchors that
 * preserve every active filter, so pagination works without JavaScript.
 */
export function CatalogPagination({
  page,
  pageCount,
  searchParams,
  labels = { previous: "Previous", next: "Next" },
  className,
}: {
  page: number;
  pageCount: number;
  searchParams: Record<string, string | undefined>;
  labels?: { previous: string; next: string };
  className?: string;
}) {
  const pathname = usePathname();

  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  /** Window of page numbers around the current page, with ellipses. */
  const pages: (number | "gap")[] = [];
  const window = 1;
  for (let index = 1; index <= pageCount; index += 1) {
    const inWindow = Math.abs(index - page) <= window;
    const isEdge = index === 1 || index === pageCount;
    if (inWindow || isEdge) {
      pages.push(index);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <Pagination className={cn("my-10", className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href={href(page - 1)}
            aria-label={labels.previous}
            aria-disabled={page <= 1}
            className={cn(page <= 1 && "pointer-events-none opacity-40")}
          >
            <ChevronLeft className="size-4 rtl-flip" aria-hidden="true" />
            <span className="hidden sm:inline">{labels.previous}</span>
          </PaginationLink>
        </PaginationItem>

        {pages.map((entry, index) =>
          entry === "gap" ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink href={href(entry)} isActive={entry === page}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationLink
            href={href(page + 1)}
            aria-label={labels.next}
            aria-disabled={page >= pageCount}
            className={cn(page >= pageCount && "pointer-events-none opacity-40")}
          >
            <span className="hidden sm:inline">{labels.next}</span>
            <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}