import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { hasAnyDemoBooks } from "@/lib/queries/demo";

/**
 * Visible reminder shown while the catalogue is made of demo books.
 * It disappears automatically as soon as the demo rows are removed (step 4).
 */
export async function DemoBanner() {
  if (!(await hasAnyDemoBooks())) return null;
  const t = await getTranslations("common");

  return (
    <Alert className="bg-brand/8 text-brand border-brand/20 rounded-none border-x-0 border-t-0 py-2 text-center sm:py-2.5">
      <AlertDescription className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">{t("demoNotice")}</span>
      </AlertDescription>
    </Alert>
  );
}
