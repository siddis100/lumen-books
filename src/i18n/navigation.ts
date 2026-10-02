import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link`, `next/navigation` and
 * `next/image`. Always use these instead of the Next.js originals so that the
 * active locale prefix is preserved.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);