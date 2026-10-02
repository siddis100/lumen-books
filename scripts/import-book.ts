/**
 * Imports one `D:\livrepdf\<dossier>` into the catalogue.
 *
 * Reuses the exact same helpers the admin panel uses (`uploadCover`,
 * `uploadPdf`) so a scripted import and a manual one are indistinguishable:
 * same buckets, same key layout, same content types, same size guards.
 *
 * Dry run by default — pass `--apply` to write anything.
 *
 *   npx tsx scripts/import-book.ts "D:\livrepdf\Dossier" --apply
 *
 * Flags:
 *   --apply              actually write (storage + database)
 *   --price <cents>      price in cents (default 490)
 *   --slug <slug>        override the generated slug
 *   --language <code>    en|fr|ar|es|de|pt|other (default: metadata, else fr)
 *   --genre <text>       category name; created on the fly when missing
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { eq } from "drizzle-orm";

/**
 * The app modules read `process.env` at import time, so `.env.local` has to be
 * in place *before* the first dynamic `import("@/lib/...")`.
 */
for (const file of [".env.local", ".env"]) {
  try {
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i).trim();
      if (process.env[key]) continue;
      process.env[key] = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\\n/g, "\n");
    }
    break;
  } catch {
    /* .env.local absent: rely on the ambient environment */
  }
}

type Meta = {
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
  page_count?: string | number;
  language?: string;
  pdf_file?: string;
  cover_file?: string;
  pdf_bytes?: number;
  pdf_sha256?: string;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const APPLY = flag("apply");
const PRICE = Number(opt("price") ?? 490);

/** Mirrors `safeName()` in src/lib/admin/storage.ts. */
function safeName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/** Kebab-case slug accepted by bookFormSchema (lowercase ascii, no accents). */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

const FRENCH_NAMES: Record<string, { fr: string; ar: string }> = {
  sciences: { fr: "Sciences", ar: "علوم" },
};

async function main() {
  const folder = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
  const dir = folder ?? args[0];
  if (!dir) {
    console.error("usage: npx tsx scripts/import-book.ts <dossier> [--apply] [--price 490]");
    process.exit(2);
  }

  const meta = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8")) as Meta;
  const pdfPath = join(dir, meta.pdf_file ?? "livre.pdf");
  const coverPath = join(dir, meta.cover_file ?? "couverture.jpg");

  const pdfBuf = readFileSync(pdfPath);
  const coverBuf = readFileSync(coverPath);

  const title = (meta.title ?? basename(dir)).trim();
  const author = (meta.author ?? "Auteur inconnu").trim();
  const description = (meta.description ?? "").trim();
  const slug = opt("slug") ?? slugify(title);
  const pages = Number(meta.page_count) || null;
  const language = opt("language") ?? (meta.language || "fr");
  const genre = opt("genre") ?? meta.genre ?? "Sciences";

  const { BOOK_LANGUAGES } = await import("@/lib/db/schema");
  type BookLanguage = (typeof BOOK_LANGUAGES)[number];
  if (!(BOOK_LANGUAGES as readonly string[]).includes(language)) {
    throw new Error(`langue invalide "${language}" (attendu : ${BOOK_LANGUAGES.join(", ")})`);
  }
  const lang = language as BookLanguage;

  // Fail fast on the two things a bad import would silently ruin.
  if (pdfBuf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("livre.pdf n'est pas un PDF");
  if (!pdfBuf.subarray(-1024).toString("latin1").includes("%%EOF")) throw new Error("PDF tronque (%%EOF absent)");

  const { db } = await import("@/lib/db");
  const { books, categories } = await import("@/lib/db/schema");
  const { uploadCover, uploadPdf } = await import("@/lib/admin/storage");

  const genreSlug = slugify(genre);

  const existing = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (existing.length > 0 && !flag("force")) {
    console.error(`Un livre existe deja avec le slug "${slug}" (id ${existing[0].id}).`);
    console.error("Rejoue avec --force pour le mettre a jour.");
    process.exit(1);
  }

  console.log(`dossier   ${basename(dir)}`);
  console.log(`titre     ${title}`);
  console.log(`auteur    ${author}`);
  console.log(`slug      ${slug}`);
  console.log(`categorie ${genre} (${genreSlug})`);
  console.log(`langue    ${lang}`);
  console.log(`pages     ${pages ?? "-"}`);
  console.log(`prix      ${PRICE} cents`);
  console.log(`pdf       ${(pdfBuf.length / 1024 / 1024).toFixed(2)} Mo`);
  console.log(`couverture ${(coverBuf.length / 1024).toFixed(0)} Ko`);
  console.log(`mode      ${APPLY ? "APPLY (ecriture)" : "DRY RUN (aucune ecriture)"}`);

  if (!APPLY) {
    console.log("");
    console.log("Ajoute --apply pour ecrire dans Supabase.");
    return;
  }

  // --- category -----------------------------------------------------------
  let categoryId: string | null = null;
  const found = await db.select().from(categories).where(eq(categories.slug, genreSlug)).limit(1);
  if (found.length > 0) {
    categoryId = found[0].id;
    console.log(`\n[1/3] categorie existante : ${genreSlug}`);
  } else {
    const names = FRENCH_NAMES[genreSlug];
    const inserted = await db
      .insert(categories)
      .values({
        slug: genreSlug,
        nameEn: genre,
        nameFr: names?.fr ?? genre,
        nameAr: names?.ar ?? genre,
      })
      .returning({ id: categories.id });
    categoryId = inserted[0].id;
    console.log(`\n[1/3] categorie creee : ${genreSlug}`);
  }

  // --- files --------------------------------------------------------------
  const pdfFile = new File([pdfBuf], "livre.pdf", { type: "application/pdf" });
  const coverFile = new File([coverBuf], "couverture.jpg", { type: "image/jpeg" });

  const pdf = await uploadPdf(pdfFile, slug);
  if (!pdf.ok) throw new Error(`upload PDF refuse : ${pdf.error}`);
  console.log(`[2/3] pdf      ${pdf.path} (${pdf.sizeBytes} octets)`);

  const cover = await uploadCover(coverFile, slug);
  if (!cover.ok) throw new Error(`upload couverture refuse : ${cover.error}`);
  console.log(`[2/3] cover   ${cover.path} (${cover.sizeBytes} octets)`);

  // --- row ----------------------------------------------------------------
  const row = {
    slug,
    title,
    author,
    description: description || title,
    categoryId,
    priceCents: PRICE,
    currency: "USD" as const,
    language: lang,
    formats: ["pdf" as const],
    pages,
    coverPath: cover.path,
    pdfPath: pdf.path,
    pdfSizeBytes: pdf.sizeBytes,
    pdfMimeType: "application/pdf",
    isActive: true,
    isDemo: false,
    isFeatured: false,
    updatedAt: new Date(),
  };

  let id: string;
  if (existing.length > 0) {
    id = existing[0].id;
    await db.update(books).set(row).where(eq(books.id, id));
    console.log(`[3/3] ligne mise a jour : ${id}`);
  } else {
    const inserted = await db.insert(books).values(row).returning({ id: books.id });
    id = inserted[0].id;
    console.log(`[3/3] ligne inseree : ${id}`);
  }

  // --- read back ----------------------------------------------------------
  const check = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const b = check[0];
  console.log("");
  console.log("verification");
  console.log(`  slug        ${b.slug}`);
  console.log(`  titre       ${b.title}`);
  console.log(`  prix        ${b.priceCents} ${b.currency}`);
  console.log(`  actif       ${b.isActive}`);
  console.log(`  demo        ${b.isDemo}`);
  console.log(`  pdf_path    ${b.pdfPath}`);
  console.log(`  cover_path  ${b.coverPath}`);
  console.log(`  categorie   ${categoryId}`);
  console.log("");
  console.log(`OK - disponible sur /${language === "fr" ? "fr" : "en"}/books/${slug}`);
}

main().catch((e) => {
  console.error("");
  console.error(`ECHEC : ${(e as Error).message}`);
  process.exit(1);
});