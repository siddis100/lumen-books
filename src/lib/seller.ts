import "server-only";

import { contactEmail } from "@/lib/env";

/**
 * Seller identity, rendered on the legal pages.
 *
 * Every field comes from the environment so the identity can be corrected
 * without touching the code, and each one is optional: an unset field is
 * simply not rendered, which keeps the pages honest (no invented address)
 * while the project is still being configured.
 */

export type SellerInfo = {
  /** Trade name shown everywhere in the interface. */
  name: string;
  /** Registered legal name, when different from the trade name. */
  legalName: string | null;
  /** `company` or `individual`: drives which legal lines make sense. */
  kind: "company" | "individual";
  /** Postal address, one line per array entry. */
  address: string[];
  /** VAT / tax identification number. */
  vat: string | null;
  /** Registry number (company registration, RCS, …). */
  registry: string | null;
  /** Country of the registered place of business. */
  country: string | null;
  /** Governing law, as written in the terms. */
  governingLaw: string | null;
  /** Support address, always present. */
  email: string;
  /** False while mandatory details are still missing. */
  complete: boolean;
};

function lines(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("\\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function sellerInfo(): SellerInfo {
  const name = process.env.SELLER_NAME?.trim() || "Lumen Books";
  const legalName = process.env.SELLER_LEGAL_NAME?.trim() || null;
  const kind: SellerInfo["kind"] =
    process.env.SELLER_KIND?.trim().toLowerCase() === "company" ? "company" : "individual";
  const address = lines(process.env.SELLER_ADDRESS);
  const vat = process.env.SELLER_VAT?.trim() || null;
  const registry = process.env.SELLER_REGISTRY?.trim() || null;
  const country = process.env.SELLER_COUNTRY?.trim() || null;
  const governingLaw = process.env.SELLER_GOVERNING_LAW?.trim() || null;

  // A missing address or a missing governing law is what a regulator asks
  // about first, so those two drive the "incomplete" flag.
  const complete = address.length > 0 && Boolean(governingLaw);

  return {
    name,
    legalName: legalName && legalName !== name ? legalName : null,
    kind,
    address,
    vat,
    registry,
    country,
    governingLaw,
    email: contactEmail(),
    complete,
  };
}
