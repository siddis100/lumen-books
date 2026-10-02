"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Star, Trash2, X } from "lucide-react";

import { AuthMessage } from "@/components/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { deleteReviewAction, setReviewStatusAction } from "@/app/actions/admin/reviews";

type Review = {
  id: string;
  status: "pending" | "approved" | "rejected";
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
};

type Props = {
  locale: string;
  bookTitle: string;
  bookSlug: string;
  review: Review;
};

/**
 * One moderation row. Approving a review does NOT recompute the book's rating
 * here: the storefront recomputes aggregates from the approved set, and the
 * delete action does it explicitly when a review disappears.
 */
export function ReviewRow({ locale, bookTitle, bookSlug, review }: Props) {
  const t = useTranslations("admin.reviews");
  const ta = useTranslations("admin.actions");

  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function moderate(status: "approved" | "rejected") {
    startTransition(async () => {
      const result = await setReviewStatusAction(review.id, status, locale);
      setFeedback(result.ok ? { tone: "success", text: status } : { tone: "error", text: result.error });
    });
  }

  return (
    <li className="bg-card border-border/70 rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {review.authorName} — {bookTitle}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: review.rating }).map((_, index) => (
                <Star key={index} className="size-3.5 fill-current" aria-hidden />
              ))}
              <span className="sr-only">{t("rating")}</span>
            </span>
            <a href={`/${locale}/books/${bookSlug}`} className="ml-2 hover:underline">
              {bookTitle}
            </a>
          </p>
        </div>
        <Badge
          variant={
            review.status === "approved" ? "default" : review.status === "rejected" ? "destructive" : "secondary"
          }
        >
          {t(review.status)}
        </Badge>
      </div>

      {review.title ? <p className="mt-3 text-sm font-semibold">{review.title}</p> : null}
      <p className="text-muted-foreground mt-1 text-sm">{review.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || review.status === "approved"}
          onClick={() => moderate("approved")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {t("approve")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || review.status === "rejected"}
          onClick={() => moderate("rejected")}
        >
          <X className="size-4" aria-hidden />
          {t("reject")}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={ta("actions")}>
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{ta("actions")}</AlertDialogTitle>
              <AlertDialogDescription>{review.body.slice(0, 140)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{ta("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  startTransition(async () => {
                    const result = await deleteReviewAction(review.id, locale);
                    setFeedback(result.ok ? { tone: "success", text: "—" } : { tone: "error", text: result.error });
                  });
                }}
              >
                {ta("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {feedback ? (
        <div className="mt-3">
          <AuthMessage tone={feedback.tone}>{feedback.text}</AuthMessage>
        </div>
      ) : null}
    </li>
  );
}