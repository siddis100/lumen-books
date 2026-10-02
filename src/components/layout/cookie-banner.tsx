"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Cookie } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "lumen-cookie-consent";

export type CookieConsent = {
  /** Strictly required for cart, session and language. Always on. */
  essential: true;
  /** Optional analytics, only set when the visitor accepts. */
  analytics: boolean;
  /** ISO date of the decision. */
  decidedAt: string;
};

function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed.decidedAt !== "string") return null;
    return { essential: true, analytics: Boolean(parsed.analytics), decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

function writeConsent(consent: CookieConsent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    // Mirror to a cookie so the server can skip rendering the banner markup.
    window.document.cookie = `lumen_consent=${consent.analytics ? "all" : "essential"};path=/;max-age=31536000;samesite=lax`;
    window.dispatchEvent(new CustomEvent("lumen:consent-change", { detail: consent }));
  } catch {
    /* storage unavailable (private mode) — the banner simply reappears */
  }
}

/**
 * GDPR / RGPD consent banner.
 * Essential cookies are always used; the optional analytics switch stays off
 * until the visitor explicitly accepts it. The choice is persisted in
 * localStorage + a first-party cookie and can be changed later from the footer.
 */
export function CookieBanner() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    // Only ask once, and never flash the banner on later navigations.
    if (!readConsent()) {
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = useCallback(() => {
    writeConsent({ essential: true, analytics: true, decidedAt: new Date().toISOString() });
    setVisible(false);
    setSettingsOpen(false);
  }, []);

  const rejectOptional = useCallback(() => {
    writeConsent({ essential: true, analytics: false, decidedAt: new Date().toISOString() });
    setVisible(false);
    setSettingsOpen(false);
  }, []);

  return (
    <>
      {visible ? (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t("title")}
          className="bg-popover/95 fixed inset-x-0 bottom-0 z-60 border-t p-4 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur-md sm:p-6"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <Cookie className="text-brand mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-display text-base font-semibold">{t("title")}</p>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm text-pretty">
                  {t("body")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
                {t("customise")}
              </Button>
              <Button variant="outline" onClick={rejectOptional}>
                {t("rejectOptional")}
              </Button>
              <Button onClick={acceptAll}>{t("acceptAll")}</Button>
            </div>
          </div>
        </div>
      ) : null}

      <CookieSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        analytics={analytics}
        setAnalytics={setAnalytics}
        onAcceptAll={acceptAll}
        onSave={rejectOptional}
      />
    </>
  );
}

/** Reusable dialog so the footer can reopen the choice at any time. */
export function CookieSettingsDialog({
  open,
  onOpenChange,
  analytics,
  setAnalytics,
  onAcceptAll,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analytics: boolean;
  setAnalytics: (value: boolean) => void;
  onAcceptAll: () => void;
  onSave: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("cookies");
  const tPrivacy = useTranslations("legal.privacy");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settingsTitle")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-4 text-sm">
          <li className="border-border/70 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="cookie-essential" className="font-medium">
                {t("essential")}
              </Label>
              <Checkbox id="cookie-essential" checked disabled />
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs text-pretty">
              {t("essentialDescription")}
            </p>
          </li>
          <li className="border-border/70 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="cookie-analytics" className="font-medium">
                {t("analytics")}
              </Label>
              <Checkbox
                id="cookie-analytics"
                checked={analytics}
                onCheckedChange={(value) => setAnalytics(value === true)}
              />
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs text-pretty">
              {t("analyticsDescription")}
            </p>
          </li>
        </ul>

        {children}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
          <Button variant="outline" onClick={onSave}>
            {t("saveSelection")}
          </Button>
          <Button onClick={onAcceptAll}>{t("acceptAll")}</Button>
        </DialogFooter>

        <p className="text-muted-foreground text-xs text-pretty">
          {t("learnMore")} — {tPrivacy("title")}
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** Stable subscribe: `writeConsent` already announces every change. */
function subscribeToConsent(onChange: () => void) {
  window.addEventListener("lumen:consent-change", onChange);
  return () => window.removeEventListener("lumen:consent-change", onChange);
}

/** Current analytics choice, or `false` before anything was decided. */
function consentSnapshot() {
  return readConsent()?.analytics ?? false;
}

/** Footer link that reopens the cookie settings dialog. */
export function FooterSettingsButton({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Draft value while the dialog is being edited; `null` means "follow storage",
  // so the checkbox starts from the stored decision without an effect.
  const [draft, setDraft] = useState<boolean | null>(null);
  const storedAnalytics = useSyncExternalStore(subscribeToConsent, consentSnapshot, () => false);
  const analytics = draft ?? storedAnalytics;

  const save = useCallback(() => {
    writeConsent({ essential: true, analytics, decidedAt: new Date().toISOString() });
    setDraft(null);
    setOpen(false);
  }, [analytics]);

  const acceptAll = useCallback(() => {
    setDraft(null);
    writeConsent({ essential: true, analytics: true, decidedAt: new Date().toISOString() });
    setOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:text-foreground text-start transition-colors"
      >
        {label}
      </button>
      <CookieSettingsDialog
        open={open}
        onOpenChange={setOpen}
        analytics={analytics}
        setAnalytics={setDraft}
        onAcceptAll={acceptAll}
        onSave={save}
      >
        {children}
      </CookieSettingsDialog>
    </>
  );
}
