"use client";

import { useTransition } from "react";
import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABELS: Record<Locale, { native: string; short: string }> = {
  en: { native: "English", short: "EN" },
  fr: { native: "Français", short: "FR" },
  ar: { native: "العربية", short: "AR" },
};

/**
 * Locale switcher. Keeps the visitor on the same page: `usePathname` returns the
 * pathname without the locale prefix, so replacing it with another locale
 * simply swaps the prefix.
 */
export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSelect(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next, scroll: false });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "sm"}
          className={compact ? "text-muted-foreground size-9" : "text-muted-foreground gap-1.5"}
          aria-label={t("language")}
        >
          <Globe className="size-4.5" />
          {compact ? null : <span className="text-xs font-semibold">{LABELS[locale].short}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => onSelect(code)}
            className="justify-between gap-4"
            lang={code}
            dir={code === "ar" ? "rtl" : "ltr"}
          >
            <span>{LABELS[code].native}</span>
            {code === locale ? <Check className="text-brand size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}