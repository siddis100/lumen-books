/**
 * Reports which environment variables are present, without ever printing a
 * value. Run it before a deploy and before filling `.env.local`:
 *
 *   node scripts/check-env.mjs
 *
 * A variable left at the `xxx` placeholder copied from `.env.example` counts as
 * missing, because that is exactly what it is.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** `required` blocks the deploy; `optional` only downgrades a feature. */
const EXPECTED = [
  { name: "NEXT_PUBLIC_SITE_URL", required: true, note: "public origin, e.g. https://lumenbooks.store" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, note: "read by the browser for auth" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, note: "read by the browser for auth" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, note: "server only, never exposed" },
  { name: "DATABASE_URL", required: true, note: "pooler port 6543, password URL-encoded" },
  { name: "ADMIN_EMAILS", required: true, note: "comma separated, grants the admin role" },
  { name: "CRON_SECRET", required: false, note: "also signs guest download links" },
  { name: "DOWNLOAD_LINK_SECRET", required: false, note: ">= 8 chars, guest download links" },
  { name: "PAYPAL_ENV", required: false, note: "sandbox until the webhook is live" },
  { name: "PAYPAL_CLIENT_ID", required: false, note: "sandbox app" },
  { name: "PAYPAL_CLIENT_SECRET", required: false, note: "sandbox app" },
  { name: "NEXT_PUBLIC_PAYPAL_CLIENT_ID", required: false, note: "same value as PAYPAL_CLIENT_ID" },
  { name: "NEXT_PUBLIC_PAYPAL_ENV", required: false, note: "same value as PAYPAL_ENV" },
  { name: "PAYPAL_WEBHOOK_ID", required: false, note: "only after the site is deployed" },
  { name: "RESEND_API_KEY", required: false, note: "order and contact emails" },
  { name: "EMAIL_FROM", required: false, note: "verified sender" },
  { name: "CONTACT_EMAIL", required: false, note: "shown in the footer" },
  { name: "SELLER_NAME", required: false, note: "legal pages" },
  { name: "SELLER_ADDRESS", required: false, note: "lines separated by \\n" },
  { name: "SELLER_GOVERNING_LAW", required: false, note: "legal pages" },
];

const PLACEHOLDERS = new Set(["", "xxx", "changeme", "todo", "your-value-here"]);

/**
 * A secret whose value is still byte-identical to the one shipped in
 * `.env.example` has not been filled in, whatever it looks like: the new
 * Supabase keys are long random `sb_secret_…` tokens, so no regex can tell a
 * real one from the sample. Equality with the example is the only reliable
 * signal. Restricted to secrets so that a legitimately shared value (a dev
 * origin like `http://localhost:3000`) is not reported as a problem.
 */
const SECRET_NAME = /(KEY|SECRET|PASSWORD|TOKEN)/;

/**
 * Tokens left over from `.env.example`. A value can be non-empty and still be
 * unusable — `postgres://postgres.<REGION>:...` is the classic case.
 */
const INLINE = [
  /YOUR_/i,
  /REGION/,
  /\bREF\b/i,
  /\byour\b/i,
  // `Lumen Books <orders@…>` is a valid sender, so only flag angle brackets
  // that do not wrap an email address.
  /<(?![\w.+-]+@)[^>]+>/,
  /\bx{3,}\b/i,
  /replace-?me/i,
  /example\.(com|org|net)/i,
];

function parseDotEnv(file) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.set(name, value);
  }
  return out;
}

const sources = [".env.local", ".env", ".env.production"]
  .map((file) => parseDotEnv(path.join(ROOT, file)))
  .filter((map) => map.size > 0);

/** The shipped template, used as the reference for "was this ever filled in?". */
const template = parseDotEnv(path.join(ROOT, ".env.example"));

/** Reads the live environment first, then the dotenv files. */
function read(name) {
  const fromProcess = process.env[name];
  if (typeof fromProcess === "string" && fromProcess !== "") return fromProcess;
  for (const map of sources) {
    const value = map.get(name);
    if (value !== undefined) return value;
  }
  return undefined;
}

const rows = EXPECTED.map(({ name, required, note }) => {
  const value = read(name);
  let state = "ok";
  if (value === undefined) {
    state = "absent";
  } else if (PLACEHOLDERS.has(value.toLowerCase())) {
    state = "placeholder";
  } else if (INLINE.some((pattern) => pattern.test(value))) {
    // Non-empty, but still carries a token copied from `.env.example`.
    state = "incomplete";
  } else if (SECRET_NAME.test(name) && template.get(name) === value) {
    // A real-shaped secret that is still the sample shipped with the project.
    state = "example";
  }
  return { name, required, note, state };
});

const pad = (value, width) => String(value).padEnd(width, " ");
const LABEL = {
  ok: "OK",
  incomplete: "INCOMPLETE",
  example: "EXAMPLE",
  placeholder: "PLACEHOLDER",
  absent: "ABSENT",
};

console.log(`\nLumen Books - environment check (${sources.length} dotenv file(s) read)\n`);
for (const row of rows) {
  console.log(
    `${pad(LABEL[row.state], 12)} ${pad(row.name, 32)} ${row.required ? "required" : "optional"}  ${row.note}`,
  );
}

const blocking = rows.filter((row) => row.required && row.state !== "ok");
const degraded = rows.filter((row) => !row.required && row.state !== "ok");
const half = rows.filter((row) => row.state === "incomplete");
const samples = rows.filter((row) => row.state === "example");

console.log("");
if (blocking.length === 0) {
  console.log("All required variables are set. The build and the storefront will work.");
} else {
  console.log(`Missing required variables: ${blocking.map((r) => r.name).join(", ")}`);
  console.log("The build still passes without them, but the site degrades:");
  console.log("  catalogue empty (no DATABASE_URL), no login (no Supabase), no checkout (no PayPal).");
}
if (half.length > 0) {
  console.log(
    `Still carrying a .env.example token: ${half.map((r) => r.name).join(", ")}`,
  );
  console.log("Those values look filled in but will fail at runtime.");
}
if (samples.length > 0) {
  console.log(
    `Still the value shipped in .env.example: ${samples.map((r) => r.name).join(", ")}`,
  );
  console.log("Supabase > Project Settings > API Keys, then paste the real secret here.");
}
if (degraded.length > 0) {
  console.log(`Optional features disabled: ${degraded.map((r) => r.name).join(", ")}`);
}
console.log("");

process.exit(blocking.length === 0 ? 0 : 1);
