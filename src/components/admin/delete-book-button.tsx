"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";

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
import { deleteBookAction } from "@/app/actions/admin/books";

type Props = {
  bookId: string;
  title: string;
  locale: string;
  hasOrders: boolean;
};

/**
 * Destructive action with an explicit confirmation step. A title that already
 * appears in an order line cannot be hard-deleted (`deleteBlocked`), so the
 * admin is told to unpublish it instead of hitting a generic failure.
 */
export function DeleteBookButton({ bookId, title, locale, hasOrders }: Props) {
  const t = useTranslations("admin.books");
  const ta = useTranslations("admin.actions");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (hasOrders) {
    return <p className="text-muted-foreground text-sm">{t("deleteBlocked")}</p>;
  }

  return (
    <div className="space-y-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {title} — {t("deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ta("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open long enough to surface the failure.
                event.preventDefault();
                startTransition(async () => {
                  const result = await deleteBookAction(bookId, locale);
                  if (!result.ok) setError(result.error);
                });
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error === "delete_blocked" ? <AuthMessage tone="error">{t("deleteBlocked")}</AuthMessage> : null}
    </div>
  );
}