import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Inline status banner for auth forms (error, success, info).
 *
 * Errors are announced politely rather than abruptly, and colour is never the
 * only signal: an icon and the wording carry the meaning too.
 */
export function AuthMessage({
  tone,
  children,
  className,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    error: "border-destructive/30 bg-destructive/8 text-destructive",
    success: "border-emerald-600/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400",
    info: "border-border bg-muted/50 text-muted-foreground",
  } as const;

  const icons = {
    error: <AlertCircle className="size-4 shrink-0" aria-hidden />,
    success: <CheckCircle2 className="size-4 shrink-0" aria-hidden />,
    info: <Info className="size-4 shrink-0" aria-hidden />,
  } as const;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        styles[tone],
        className,
      )}
    >
      {icons[tone]}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
