import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible star rating.
 * The numeric value is exposed to assistive tech via `aria-label`, while the
 * stars themselves are decorative.
 */
export function RatingStars({
  value,
  size = "sm",
  showValue = false,
  count,
  className,
}: {
  value: number;
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  const sizes = { xs: "size-3", sm: "size-3.5", md: "size-4.5" } as const;
  const rounded = Math.round(value * 2) / 2;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((position) => {
          const filled = rounded >= position;
          const half = !filled && rounded >= position - 0.5;
          return (
            <span key={position} className="relative inline-block">
              <Star className={cn(sizes[size], "text-border")} />
              {(filled || half) && (
                <span
                  className={cn(
                    "absolute inset-0 overflow-hidden text-brand",
                    half && "w-1/2",
                  )}
                >
                  <Star className={cn(sizes[size], "fill-current")} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className="text-muted-foreground text-xs font-medium tabular-nums">
          {value > 0 ? value.toFixed(1) : "—"}
          {count ? ` (${count})` : ""}
        </span>
      ) : null}
    </div>
  );
}