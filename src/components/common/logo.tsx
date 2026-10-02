import type * as React from "react";

/** Brand wordmark: a small lumen mark followed by the name. */
export function Logo({
  className,
  showText = true,
  ...props
}: React.ComponentProps<"span"> & { showText?: boolean }) {
  return (
    <span className={className} {...props}>
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="bg-brand text-brand-foreground ring-brand/25 relative grid size-8 place-items-center rounded-lg shadow-sm ring-4"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4.5">
            <path
              d="M5 4.75h9.5A2.5 2.5 0 0 1 17 7.25v12a1 1 0 0 1-1.53.85L11 18.2l-4.47 1.9A1 1 0 0 1 5 19.15V4.75Z"
              fill="currentColor"
              opacity="0.95"
            />
            <path d="M8.5 4.75v13.2" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          </svg>
        </span>
        {showText ? (
          <span className="font-display text-lg leading-none font-semibold tracking-tight">
            Lumen <span className="text-brand">Books</span>
          </span>
        ) : null}
      </span>
    </span>
  );
}