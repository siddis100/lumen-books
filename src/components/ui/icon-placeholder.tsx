"use client";

import * as LucideIcons from "lucide-react";
import type * as React from "react";

/**
 * Shim for the multi-library `IconPlaceholder` markup emitted by the shadcn
 * registry. This project is configured with `iconLibrary: "lucide"`, so the
 * lucide name is rendered and the other library names are discarded.
 */
export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...props
}: {
  lucide: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
} & React.ComponentProps<"svg">) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<React.ComponentProps<"svg">>>)[lucide];
  if (!Icon) return null;
  return <Icon aria-hidden="true" {...props} />;
}