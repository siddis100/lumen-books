/**
 * Applies `db/migrations/0000_init.sql` then `db/seed.sql` to the Supabase
 * database configured in `DATABASE_URL`.
 *
 *   node scripts/migrate.mjs           # dry run, prints the plan and stops
 *   node scripts/migrate.mjs --apply   # actually runs it
 *   node scripts/migrate.mjs --apply --seed   # also loads the demo catalogue
 *
 * Both files are plain SQL with no psql meta-commands, so they can be pasted
 * into the Supabase SQL editor as well. The whole migration runs in a single
 * transaction: either every table, index, RLS policy and storage bucket
 * exists, or nothing was created.
 */

import fs from "node:fs";

function parseDotEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...parseDotEnv(".env.local"), ...parseDotEnv(".env"), ...process.env };
// --seed-only reloads db/seed.sql on a database that is already migrated,
// without replaying 0000_init.sql.
const seedOnly = process.argv.includes("--seed-only");
const apply = process.argv.includes("--apply") || seedOnly;
const withSeed = process.argv.includes("--seed") || seedOnly;

const url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Fill .env.local (see .env.example).");
  process.exit(2);
}

for (const token of ["REGION", "YOUR_", "<"]) {
  if (url.includes(token)) {
    console.error(
      `DATABASE_URL still contains the template token "${token}". Replace it with the real connection string from Supabase > Project Settings > Database.`,
    );
    process.exit(2);
  }
}

const MIGRATIONS_DIR = "db/migrations";
const SEED = "db/seed.sql";
const sqlText = (file) => {
  if (!fs.existsSync(file)) {
    console.error(`${file} is missing.`);
    process.exit(2);
  }
  return fs.readFileSync(file, "utf8");
};

// Applied in filename order, so 0000_init.sql always comes before 0001_lock_data_api.sql.
const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const countStatements = (text) => text.split(/;\s*\n/).length - 1;
const migrations = seedOnly
  ? []
  : fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => ({ file: `${MIGRATIONS_DIR}/${name}`, sql: sqlText(`${MIGRATIONS_DIR}/${name}`) }));

console.log(`\nLumen Books - database migration`);
if (seedOnly) {
  console.log(`  (--seed-only: migrations skipped)`);
} else {
  for (const m of migrations) {
    console.log(`  ${m.file}: ${m.sql.split("\n").length} lines, ~${countStatements(m.sql)} statements`);
  }
}
if (withSeed) {
  console.log(`  ${SEED}: demo catalogue (5 categories, 12 books, promo WELCOME10)`);
} else {
  console.log(`  ${SEED}: skipped (pass --seed to load it)`);
}

if (!apply) {
  console.log(`\nDry run. Nothing was changed. Re-run with --apply to execute.\n`);
  process.exit(0);
}

const { default: postgres } = await import("postgres");
const sql = postgres(url, { connect_timeout: 15, max: 1, ssl: "require" });

try {
  if (!seedOnly) {
    const existing = await sql`
      select count(*)::int as count from information_schema.tables
      where table_schema = 'public' and table_name = 'orders'
    `;
    if (existing[0].count > 0) {
      console.error(
        "\nA public `orders` table already exists. Refusing to run the migration again:",
      );
      console.error("  it would fail halfway and, inside a transaction, roll everything back.");
      console.error("  If you really want a clean slate, drop the public schema in the Supabase SQL editor first.");
      console.error("  To only reload the demo catalogue, use: npm run db:seed -- --seed-only\n");
      process.exit(1);
    }
  }

  console.log(seedOnly ? "\nLoading the demo catalogue..." : "\nApplying migrations in a single transaction...");
  await sql.begin(async (tx) => {
    for (const m of migrations) {
      console.log(`  -> ${m.file}`);
      await tx.unsafe(m.sql);
    }
    if (withSeed) await tx.unsafe(sqlText(SEED));
  });
  console.log("Done.");
} catch (error) {
  console.error(`\nMigration failed and was rolled back: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
