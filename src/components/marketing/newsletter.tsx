import { getTranslations } from "next-intl/server";
import { Container, Section } from "@/components/common/layout";
import { NewsletterForm } from "@/components/marketing/newsletter-form";

/** Newsletter block, reused on the home page and at the bottom of the catalogue. */
export async function Newsletter({ source = "home" }: { source?: string }) {
  const t = await getTranslations("home.newsletter");

  return (
    <Section className="bg-muted/40 border-t">
      <Container>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="max-w-xl">
            <p className="text-brand text-xs font-semibold tracking-[0.18em] uppercase">
              {t("eyebrow")}
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold text-balance">
              {t("title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-base text-pretty">{t("subtitle")}</p>
          </div>
          <NewsletterForm source={source} />
        </div>
      </Container>
    </Section>
  );
}
