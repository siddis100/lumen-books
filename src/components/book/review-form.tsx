"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/common/rating-stars";

/**
 * Review form. Posts to a server action which validates, rate-limits and
 * inserts the row with status `pending` (moderation before publication).
 */
export function ReviewForm({
  bookId,
  names = { title: "", rating: "", body: "", submit: "", needsAuth: "", thanks: "" },
}: {
  bookId: string;
  names?: Record<string, string>;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === 0) {
      toast.error(names.rating);
      return;
    }
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      const { createReviewAction } = await import("@/app/actions/reviews");
      const result = await createReviewAction({
        bookId,
        rating,
        title: String(data.get("title") ?? ""),
        body: String(data.get("body") ?? ""),
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(names.thanks);
      router.refresh();
    } catch {
      toast.error(names.needsAuth);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-muted/40 flex flex-col gap-4 rounded-xl border p-4">
      <p className="text-sm font-semibold">{names.title}</p>

      <div className="flex items-center gap-2">
        <span className="sr-only" id="rating-label">
          {names.rating}
        </span>
        <div className="flex gap-0.5" role="radiogroup" aria-labelledby="rating-label" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value}/5`}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onClick={() => setRating(value)}
              className="p-0.5"
            >
              <RatingStars value={hover || rating >= value ? 1 : 0} size="md" className="pointer-events-none" />
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{hover || rating || "—"}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-title" className="text-xs">
          {names.title}
        </Label>
        <Input id="review-title" name="title" maxLength={120} className="h-10" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="review-body" className="text-xs">
          {names.body}
        </Label>
        <Textarea id="review-body" name="body" rows={4} minLength={20} maxLength={2000} required />
      </div>

      <Button type="submit" disabled={pending} className="h-10 self-start">
        {pending ? "…" : names.submit}
      </Button>
    </form>
  );
}