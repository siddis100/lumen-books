/**
 * Reports which environment variables are present, without ever printing a
 * value. Run it before a deploy and before filling `.env.local`:
 *
 *   node scripts/check-env.mjs
 *
 * A variable left at the `xxx` placeholder copied from `.env.example` counts as
 * missing, because that is exactly what it is.
 *
 * Exit code is non-zero when a required variable is unusable, when a cross
 * variable rule is violated, or when a `critical` variable is unusable.
 * `critical` exists because "optional" is the wrong word for the email
 * variables: leaving Resend unset only removes a feature, leaving it set to a
 * placeholder silently drops every order confirmation and every guest download
 * link while the site reports itself healthy.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/**
 * `required` blocks the deploy. `critical` blocks it too, but for variables
 * that must never be a placeholder: a build can succeed with a broken email
 * sender and the failure only shows up after a real payment.
 */
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
  { name: "RESEND_API_KEY", required: false, critical: true, note: "order and contact emails" },
  { name: "EMAIL_FROM", required: false, critical: true, note: "verified sender" },
  { name: "CONTACT_EMAIL", required: false, critical: true, note: "shown in the footer" },
  { name: "SELLER_NAME", required: false, note: "legal pages" },
  { name: "SELLER_ADDRESS", required: false, note: "lines separated by \\n" },
  { name: "SELLER_GOVERNING_LAW", required: false, note: "legal pages" },
];

const PLACEHOLDERS = new Set(["", "xxx", "changeme", "todo", "your-value-here"]);

/**
 * Countries where PayPal will not open a merchant account, so a store
 * registered there cannot create live REST credentials at all. Matching is on
 * a normalised country name because `SELLER_COUNTRY` is free text written by
 * the seller, not an ISO code.
 *
 * This is a warning, not a block: the storefront, the account and the legal
 * pages can all be correct while the PayPal merchant account simply belongs to
 * another country. Better to hear it here than at the first real payment.
 */
const PAYPAL_RESTRICTED = new Set([
  "algeria",
  "dz",
  "angola",
  "azerbaijan",
  "bahrain",
  "bangladesh",
  "benin",
  "botswana",
  "burundi",
  "cambodia",
  "cameroon",
  "central african republic",
  "chad",
  "cote d ivoire",
  "ivory coast",
  "democratic republic of the congo",
  "dr congo",
  "congo",
  "egypt",
  "eswatini",
  "ethiopia",
  "gambia",
  "ghana",
  "guinea",
  "guinea-bissau",
  "kenya",
  "lesotho",
  "liberia",
  "madagascar",
  "malawi",
  "mali",
  "mauritania",
  "mozambique",
  "namibia",
  "niger",
  "nigeria",
  "rwanda",
  "senegal",
  "sierra leone",
  "somalia",
  "south sudan",
  "sudan",
  "tanzania",
  "togo",
  "uganda",
  "zambia",
  "zimbabwe",
]);

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
  // `re_xxx` is the shipped sample and `\bx{3,}\b` cannot see it, because `_` is
  // a word character and so there is no boundary before the run of x. Anchor on
  // the provider prefix instead, which no real Resend key can match: those are
  // `re_` followed by 32 mixed-case alphanumerics.
  /^re_[x*]+$/i,
  // `orders@yourdomain.com` is a syntactically valid address on a domain nobody
  // owns, and `\byour\b` misses it too, because `yourdomain` is a single word.
  // This is the exact value that shipped in `.env.example`.
  /yourdomain/i,
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

const rows = EXPECTED.map(({ name, required, critical, note }) => {
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
  return { name, required, critical, note, state };
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
  const weight = row.required ? "required" : row.critical ? "critical" : "optional";
  console.log(
    `${pad(LABEL[row.state], 12)} ${pad(row.name, 32)} ${pad(weight, 9)} ${row.note}`,
  );
}

/**
 * Cross-variable rules the per-row table cannot express.
 *
 * Every one of these has the same failure mode: the file looks filled in, the
 * table reports `OK`, and the bug only surfaces at runtime. `PAYPAL_ENV` is
 * parsed by a `z.enum` in `src/lib/env.ts`, so a value that is neither
 * `sandbox` nor `live` throws the moment the checkout touches PayPal instead of
 * degrading. The `NEXT_PUBLIC_` twins are read by the browser bundle and must
 * match their server-side counterparts exactly.
 */
const problems = [];

function problem(message) {
  problems.push(message);
}

for (const name of ["PAYPAL_ENV", "NEXT_PUBLIC_PAYPAL_ENV"]) {
  const value = read(name);
  if (value !== undefined && value !== "sandbox" && value !== "live") {
    problem(
      `${name} must be exactly "sandbox" or "live" (${value.length} characters found). ` +
        `The enum in src/lib/env.ts rejects anything else at checkout time.`,
    );
  }
}

/** The browser bundle and the server must not disagree on the PayPal app. */
for (const [server, client] of [
  ["PAYPAL_CLIENT_ID", "NEXT_PUBLIC_PAYPAL_CLIENT_ID"],
  ["PAYPAL_ENV", "NEXT_PUBLIC_PAYPAL_ENV"],
]) {
  const a = read(server);
  const b = read(client);
  if (a !== undefined && b !== undefined && a !== b) {
    problem(
      `${client} does not match ${server} (${b.length} vs ${a.length} characters). ` +
        `They must be the same value; the browser reads one and the server the other.`,
    );
  }
}

for (const name of ["EMAIL_FROM", "CONTACT_EMAIL"]) {
  const value = read(name);
  if (value !== undefined && !value.includes("@")) {
    problem(`${name} is not an email address (${value.length} characters found).`);
  }
}

/**
 * A development origin is legitimate in `.env.local` and fatal everywhere else.
 * `NEXT_PUBLIC_SITE_URL` is baked into the browser bundle, so a deploy that
 * keeps `http://localhost:3000` points every payment redirect and every emailed
 * download link at the customer's own machine. Only the process environment is
 * judged, because that is the one a deploy actually serves, and `localhost` is
 * the correct value during local development.
 */
const deployedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (
  deployedSiteUrl !== undefined &&
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(deployedSiteUrl.trim())
) {
  problem(
    "NEXT_PUBLIC_SITE_URL points at a development origin " +
      `(${deployedSiteUrl.length} characters found). ` +
      "A deploy must serve its real https origin: this value is compiled into the " +
      "browser bundle, so payment redirects and emailed download links would resolve " +
      "to localhost on the customer's machine.",
  );
}

/**
 * A confirmation email that was never sent leaves a paid customer with no
 * download link. The site still looks healthy — the build passes, the checkout
 * works — so the sender configuration has to be treated as a deploy blocker
 * rather than as a missing feature.
 */
const criticalRows = rows.filter((row) => row.critical && row.state !== "ok");
if (criticalRows.length > 0) {
  problem(
    `Unusable email configuration: ${criticalRows.map((r) => r.name).join(", ")}. ` +
      "Every order confirmation carries the download links, so with these values the " +
      "store takes payment and mails nothing. Create a real Resend API key and a " +
      "verified sending domain, then redeploy.",
  );
}

const blocking = rows.filter((row) => row.required && row.state !== "ok");
const degraded = rows.filter((row) => !row.required && !row.critical && row.state !== "ok");
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
if (problems.length > 0) {
  console.log("");
  for (const message of problems) {
    console.log(`INVALID  ${message}`);
  }
  console.log("Each of these passes the table above but fails at runtime.");
}

/* ------------------------------------------------------------------ *
 * Store country vs PayPal
 * ------------------------------------------------------------------ */

const sellerCountry = (read("SELLER_COUNTRY") ?? "").trim().toLowerCase();
if (PAYPAL_RESTRICTED.has(sellerCountry)) {
  console.log(`WARNING  SELLER_COUNTRY is "${read("SELLER_COUNTRY").trim()}", where PayPal`);
  console.log("         will not open a merchant account, so live REST credentials");
  console.log("         cannot be created for it. Consequences to plan for:");
  console.log("           - the PayPal account receiving the money must be registered");
  console.log("             in a supported country, and its country will not match the");
  console.log("             legal seller shown on the legal pages;");
  console.log("           - buyers in the same country cannot pay from a PayPal balance,");
  console.log("             only from a card in guest checkout, and PayPal may still");
  console.log("             refuse it - validate with one small real transaction;");
  console.log("           - for that audience, a local channel (CIB / Edahabia, BaridiMob)");
  console.log("             is the realistic primary route, PayPal the secondary one.");
  console.log("         Nothing above is checked here, this is a reminder before deploying.");
  console.log("");
}

process.exit(blocking.length === 0 && problems.length === 0 ? 0 : 1);
