import { getTranslations } from "next-intl/server";
import { Container } from "@/components/common/layout";
import { getAllBookSlugs } from "@/lib/queries/catalog";
import { HeroContent } from "./hero-content";

/**
 * Home hero. Purely presentational + a live count of published titles, so it
 * stays in the static shell while still feeling alive. The animations live in
 * `hero-content.tsx`, which has to be a client component.
 */
export async function Hero() {
  const t = await getTranslations("home.hero");
  const slugs = await getAllBookSlugs();

  const stats = [
    { value: String(slugs.length), label: t("statBooks") },
    { value: "24/7", label: t("statInstant") },
    { value: "PayPal", label: t("statSecure") },
    { value: "2", label: t("statLanguages") },
  ];

  return (
    <section className="bg-grain relative overflow-hidden border-b">
      {/* Decorative warm glow, hidden from assistive tech. */}
      <div
        aria-hidden="true"
        className="from-brand/20 pointer-events-none absolute -top-40 start-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-gradient-to-b to-transparent blur-3xl"
      />

      <Container className="relative py-16 sm:py-24 lg:py-28">
        <HeroContent
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          ctaPrimary={t("ctaPrimary")}
          ctaSecondary={t("ctaSecondary")}
          stats={stats}
        />
      </Container>
    </section>
  );
}