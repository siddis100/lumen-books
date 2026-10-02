"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Upload } from "lucide-react";

import { AuthMessage } from "@/components/auth/auth-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadBookCoverAction, uploadBookPdfAction } from "@/app/actions/admin/books";
import { coverUrl } from "@/lib/storage-url";

type Props = {
  bookId: string;
  locale: string;
  coverPath: string | null;
  pdfPath: string | null;
  pdfSizeBytes: number | null;
};

/**
 * Cover and PDF uploads. Both go to the server action as `multipart/form-data`
 * so the file bytes never travel through a JSON payload, and the cover/PDF
 * panels refresh themselves once the action reports success.
 */
export function BookUploads({ bookId, locale, coverPath, pdfPath, pdfSizeBytes }: Props) {
  const t = useTranslations("admin.books");
  const ta = useTranslations("admin.actions");

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const coverForm = useRef<HTMLFormElement>(null);
  const pdfForm = useRef<HTMLFormElement>(null);

  function send(
    form: HTMLFormElement | null,
    action: (id: string, data: FormData, locale: string) => Promise<{ ok: boolean; error?: string }>,
  ) {
    if (!form) return;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await action(bookId, data, locale);
      if (result.ok) {
        setFeedback({ tone: "success", text: t("updated") });
        form.reset();
        // The panel is server-rendered from the DB, so a reload is the honest
        // way to reflect the new file rather than duplicating the data layer.
        window.location.reload();
      } else {
        setFeedback({ tone: "error", text: result.error === "too_large" ? t("pdfHint") : t("uploading") });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="bg-card border-border/70 rounded-xl border p-5">
        <h3 className="font-display text-lg font-semibold">{t("cover")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("coverHint")}</p>
        {coverPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl(coverPath)} alt="" className="mt-4 h-48 w-auto rounded object-cover" />
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">{t("missingCover")}</p>
        )}
        <form
          ref={coverForm}
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(coverForm.current, uploadBookCoverAction);
          }}
        >
          <div>
            <Label htmlFor="cover" className="sr-only">
              {t("cover")}
            </Label>
            <input id="cover" name="cover" type="file" accept="image/*" className="text-sm" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {t("uploadCover")}
          </Button>
        </form>
      </section>

      <section id="pdf" className="bg-card border-border/70 rounded-xl border p-5">
        <h3 className="font-display text-lg font-semibold">{t("pdf")}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{t("pdfHint")}</p>
        {pdfPath ? (
          <p className="mt-4 flex items-center gap-2 text-sm">
            <FileText className="size-4" aria-hidden />
            {pdfPath}
            {pdfSizeBytes ? (
              <span className="text-muted-foreground">· {Math.round(pdfSizeBytes / 1024)} KB</span>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground mt-4 text-sm">{t("missingPdf")}</p>
        )}
        <form
          ref={pdfForm}
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(pdfForm.current, uploadBookPdfAction);
          }}
        >
          <div>
            <Label htmlFor="pdf" className="sr-only">
              {t("pdf")}
            </Label>
            <input id="pdf" name="pdf" type="file" accept="application/pdf" className="text-sm" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {t("uploadPdf")}
          </Button>
        </form>
      </section>

      {feedback ? <AuthMessage tone={feedback.tone}>{feedback.text}</AuthMessage> : null}
    </div>
  );
}