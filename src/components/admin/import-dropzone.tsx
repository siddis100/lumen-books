"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, UploadCloud } from "lucide-react";

import { AuthMessage } from "@/components/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importPdfsAction, type ImportResult } from "@/app/actions/admin/import";

type Row = { file: File; title: string; pages: number | null };

const MAX_FILES = 100;
const MAX_BYTES = 40 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Counts pages without a PDF library: the `/Type /Page` objects are plain text
 * inside the file. Approximate on purpose — the admin confirms the real value
 * on the book form. Returns null when the header cannot be read at all.
 */
async function countPages(file: File): Promise<number | null> {
  const head = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).text();
  const matches = head.match(/\/Type\s*\/Page[^s]/g);
  if (matches && matches.length > 0) return matches.length;
  const counted = head.match(/\/Count\s+(\d+)/g);
  if (counted?.length) return Number(counted[counted.length - 1]?.match(/\d+/)?.[0] ?? 0) || null;
  return null;
}

const titleFromName = (name: string) => name.replace(/\.pdf$/i, "").split(/\s+[—–-]\s+/)[0] ?? name;

/**
 * Bulk PDF import. Files are analysed in the browser for size / page count /
 * proposed title, then sent as `multipart/form-data` to the server action, so
 * nothing is buffered in JS state and the server trusts only the bytes it gets.
 */
export function ImportDropzone({ locale }: { locale: string }) {
  const t = useTranslations("admin.import");
  const ta = useTranslations("admin.actions");

  const [rows, setRows] = useState<Row[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = useMemo(() => rows.reduce((sum, row) => sum + row.file.size, 0), [rows]);

  async function accept(files: FileList | null) {
    if (!files?.length) return;
    const pdfs = Array.from(files).filter((file) => file.type === "application/pdf").slice(0, MAX_FILES);
    if (pdfs.length === 0) {
      setFeedback(t("importFailed"));
      return;
    }

    setAnalysing(true);
    setResult(null);
    const analysed: Row[] = [];
    for (const file of pdfs) {
      analysed.push({ file, title: titleFromName(file.name), pages: await countPages(file) });
    }
    setRows(analysed);
    setAnalysing(false);
  }

  function runImport() {
    if (rows.length === 0) return;
    const formData = new FormData();
    for (const row of rows) formData.append("files", row.file);
    formData.append("pages", JSON.stringify(rows.map((row) => row.pages ?? 0)));
    formData.append("titles", JSON.stringify(rows.map((row) => row.title)));

    startTransition(async () => {
      const outcome = await importPdfsAction(formData, locale);
      setResult(outcome);
      setRows([]);
    });
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void accept(event.dataTransfer.files);
        }}
        className="border-border/70 hover:border-brand/50 bg-card rounded-xl border border-dashed p-8 text-center"
      >
        <UploadCloud className="text-muted-foreground mx-auto size-8" aria-hidden />
        <p className="mt-3 text-sm font-medium">{t("dropzone")}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t("dropzoneHint")}</p>
        <Input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="mx-auto mt-4 max-w-sm"
          onChange={(event) => void accept(event.target.files)}
        />
      </div>

      {feedback ? <AuthMessage tone="error">{feedback}</AuthMessage> : null}
      {analysing ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("analysing")}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section aria-label={t("preview")} className="bg-card border-border/70 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3">{t("colFile")}</th>
                <th className="p-3">{t("colSize")}</th>
                <th className="p-3">{t("colPages")}</th>
                <th className="p-3">{t("colTitle")}</th>
                <th className="p-3">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.file.name}-${index}`} className="border-border/40 border-b last:border-0">
                  <td className="flex items-center gap-2 p-3">
                    <FileText className="size-4" aria-hidden />
                    <span className="max-w-56 truncate">{row.file.name}</span>
                  </td>
                  <td className="text-muted-foreground p-3 tabular-nums">{formatBytes(row.file.size)}</td>
                  <td className="text-muted-foreground p-3 tabular-nums">{row.pages ?? "—"}</td>
                  <td className="p-3">
                    <Input
                      value={row.title}
                      aria-label={t("colTitle")}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, title: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="p-3">
                    {row.file.size > MAX_BYTES ? (
                      <Badge variant="destructive">{t("importFailed")}</Badge>
                    ) : (
                      <Badge variant="outline">{ta("confirm")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-muted-foreground text-xs">
              {rows.length} · {formatBytes(totalBytes)}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRows([])}>
                {ta("cancel")}
              </Button>
              <Button size="sm" disabled={pending} onClick={runImport}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {pending ? t("importing") : t("import")}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <p className="text-sm">{t("imported", { count: result.imported })}</p>
          <ul className="space-y-1">
            {result.rows.map((row) => (
              <li key={row.name} className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                <span className="max-w-72 truncate">{row.name}</span>
                {row.ok ? (
                  <Badge variant="outline">{row.slug}</Badge>
                ) : (
                  <Badge variant="destructive">
                    {row.error === "duplicate" ? t("duplicate") : t("importFailed")}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs">{t("backupNote")}</p>
      <p className="text-muted-foreground text-xs">{t("preview")}</p>
    </div>
  );
}