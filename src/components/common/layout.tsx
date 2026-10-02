import { cn } from "@/lib/utils";

/** Page-width container used by every section. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Vertical rhythm wrapper for page sections. */
export function Section({
  className,
  children,
  id,
  as: Tag = "section",
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
  as?: "section" | "div" | "header" | "footer" | "aside";
}) {
  return (
    <Tag id={id} className={cn("py-12 sm:py-16 lg:py-20", className)}>
      {children}
    </Tag>
  );
}

/** Section heading: eyebrow + title + optional subtitle. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "start",
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "start" | "center";
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10",
        align === "center" ? "items-center text-center" : "items-start",
        action && "sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className="text-brand mb-2 text-xs font-semibold tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{title}</h2>
        {subtitle ? <p className="text-muted-foreground mt-3 text-base text-pretty">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Centred empty / zero-results state. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="text-brand mb-4">{icon}</div> : null}
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-sm text-sm text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}