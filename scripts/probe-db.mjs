/**
 * Read-only Supabase connectivity probe. Prints no credentials: only whether
 * the connection works and how many public tables exist, so we can tell if
 * `db/migrations/0000_init.sql` still has to be applied.
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
const url = env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

// Show shape only, never the credentials themselves.
const parsed = new URL(url);
console.log(
  `target: host=${parsed.hostname.split(".").slice(0, 2).join(".")}… port=${parsed.port || "5432"} db=${parsed.pathname.slice(1)}`,
);

const { default: postgres } = await import("postgres");
const sql = postgres(url, { connect_timeout: 10, max: 1, ssl: "require" });

try {
  const [row] = await sql`select current_database() as db, version() as version`;
  console.log(`connected: yes (postgres ${String(row.version).split(" ")[1]})`);

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  console.log(`public tables: ${tables.length}`);
  if (tables.length > 0) console.log(`  ${tables.map((t) => t.table_name).join(", ")}`);

  const hasOrders = tables.some((t) => t.table_name === "orders");
  if (!hasOrders) {
    console.log("verdict: migration NOT applied -> run db/migrations/0000_init.sql then db/seed.sql");
  } else {
    const [cols] = await sql`
      select
        count(*) filter (where column_name = 'locale')::int   as locale_col,
        count(*) filter (where column_name = 'emailed_at')::int as emailed_col
      from information_schema.columns
      where table_schema = 'public' and table_name = 'orders'
    `;
    console.log(
      `orders.locale: ${cols.locale_col > 0 ? "present" : "MISSING"}, orders.emailed_at: ${cols.emailed_col > 0 ? "present" : "MISSING"}`,
    );
    const [{ books }] = await sql`select count(*)::int as books from public.books`;
    console.log(`books: ${books}`);
  }
  process.exit(0);
} catch (error) {
  console.error(`connected: no -> ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
