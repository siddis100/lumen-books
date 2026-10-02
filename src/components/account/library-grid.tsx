"use client";

import { useState } from "react";

import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { coverUrl } from "@/lib/storage-url";
import type { LibraryEntry } from "@/lib/account";

/**
 * Library grid with download buttons.
 *
 * The button is a real link to `/api/downloads/[orderItemId]`: that route
 * re-checks payment, webhook confirmation and ownership, then redirects to a
 * 5-minute Supabase signed URL. Nothing about the file path is exposed here.
 */
export function LibraryGrid({ entries }: { entries: LibraryEntry[] }) {
  const t = useTranslations("account.downloads");
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const ready = Boolean(entry.pdfPath);
        const href = `/api/downloads/${entry.id}`;

        return (
          <li
            key={entry.id}
            className="bg-card border-border/70 flex gap-4 rounded-xl border p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl(entry.coverPath)}
              alt=""
              width={64}
              height={88}
              loading="lazy"
              className="h-22 w-16 shrink-0 rounded object-cover"
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-display text-sm leading-snug font-semibold text-balance">
                {entry.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{entry.author}</p>

              <div className="mt-auto pt-3">
                {ready ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={href} onClick={() => setBusy(entry.id)}>
                      {busy === entry.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="size-4" aria-hidden />
                      )}
                      {t("download")}
                    </a>
                  </Button>
                ) : (
                  <Badge variant="secondary">{t("pending")}</Badge>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}