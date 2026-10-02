import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

// Static imports keep the bundler able to trace every message file (a fully
// dynamic `import()` template cannot be resolved by Turbopack/webpack).
const MESSAGES: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("../messages/en.json"),
  fr: () => import("../messages/fr.json"),
  ar: () => import("../messages/ar.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` comes from the `[locale]` segment / the proxy matcher.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await MESSAGES[locale]()).default as never,
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
    },
  };
});