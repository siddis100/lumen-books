import { BookOpen, Download, RefreshCw } from "lucide-react";

import { Container, Section } from "@/components/common/layout";

/**
 * Shared shell for every auth page: a centred card plus the three reasons to
 * create an account. The page supplies the translated strings, so the shell
 * stays free of translation plumbing and renders identically in all languages
 * (the card flips to RTL with the document).
 */
export function AuthShell({
  title,
  subtitle,
  benefitsTitle,
  benefits,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  benefitsTitle: string;
  benefits: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const icons = [BookOpen, Download, RefreshCw];

  return (
    <Section className="bg-muted/30">
      <Container className="max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="bg-card border-border/70 rounded-xl border p-6 shadow-sm sm:p-8">
            <h1 className="font-display text-2xl font-semibold text-balance sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-muted-foreground mt-2 text-sm text-pretty">{subtitle}</p>
            ) : null}
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 border-t pt-5">{footer}</div> : null}
          </div>

          <aside className="bg-muted/40 border-border/70 rounded-xl border p-6">
            <p className="font-display text-base font-semibold">{benefitsTitle}</p>
            <ul className="mt-4 space-y-3">
              {benefits.map((benefit, index) => {
                const Icon = icons[index] ?? BookOpen;
                return (
                  <li key={benefit} className="flex items-start gap-2.5 text-sm">
                    <Icon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="text-pretty">{benefit}</span>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </Container>
    </Section>
  );
}