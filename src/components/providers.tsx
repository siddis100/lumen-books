"use client";

import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers shared by every locale.
 * - `next-themes` handles the light/dark preference without a flash.
 * - `nuqs` keeps catalogue filters in the URL so they are shareable and
 *   survive back/forward navigation.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="lumen-theme"
    >
      <NuqsAdapter>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" closeButton richColors />
      </NuqsAdapter>
    </ThemeProvider>
  );
}