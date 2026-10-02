import { Fraunces, Geist_Mono, Inter, Noto_Sans_Arabic } from "next/font/google";

/**
 * Type stack for Lumen Books.
 * - Inter: UI / body copy (latin)
 * - Fraunces: display headings, the "literary" serif (latin)
 * - Noto Sans Arabic: body + headings for the Arabic (RTL) locale
 * All fonts are self-hosted by `next/font` so no third-party request is made
 * at runtime, which keeps the Lighthouse performance score and privacy intact.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-lb-sans",
  display: "swap",
});

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-lb-heading",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-lb-mono",
  display: "swap",
});

export const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-lb-arabic",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${fraunces.variable} ${geistMono.variable} ${notoArabic.variable}`;