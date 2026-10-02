#!/usr/bin/env node
/**
 * Compares the key trees of the three locales and reports any key that is
 * missing from one of them, or present in only one.
 *
 * Rationale: next-intl throws MISSING_MESSAGE at render time and falls back to
 * printing the raw key, which reaches the customer as `catalog.sortRelevance`.
 * That failure only shows up on the page that uses it, in that one locale, so it
 * survives a build. This script turns it into a failing check.
 *
 * Exits 0 when the three locales have identical key trees, 1 otherwise.
 */
import fs from "node:fs";
import path from "node:path";

const MESSAGES_DIR = path.join(process.cwd(), "src", "messages");
const REFERENCE = "en";
const LOCALES = ["fr", "ar"];

function readMessages(locale) {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.error(`missing file: ${file}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`${locale}.json is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

/** Flattens the nested object into dot-separated leaf keys. */
function keyTree(node, prefix = "") {
  const out = new Set();
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    out.add(prefix);
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    const path_ = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const child of keyTree(value, path_)) out.add(child);
    } else {
      out.add(path_);
    }
  }
  return out;
}

const referenceKeys = keyTree(readMessages(REFERENCE));
console.log(
  `${REFERENCE}.json: ${referenceKeys.size} leaf keys (reference)\n`,
);

let failures = 0;

for (const locale of LOCALES) {
  const keys = keyTree(readMessages(locale));
  const missing = [...referenceKeys].filter((key) => !keys.has(key)).sort();
  const extra = [...keys].filter((key) => !referenceKeys.has(key)).sort();

  if (missing.length === 0 && extra.length === 0) {
    console.log(`${locale}.json: OK (${keys.size} keys)`);
    continue;
  }

  failures += 1;
  console.log(`${locale}.json: ${missing.length} missing, ${extra.length} unknown`);
  for (const key of missing) console.log(`  missing  ${key}`);
  for (const key of extra) console.log(`  unknown  ${key}`);
  console.log("");
}

if (failures > 0) {
  console.error(
    `i18n audit failed for ${failures} locale(s). A missing key renders as its raw name on the page.`,
  );
  process.exit(1);
}

console.log("\nall locales share the same key tree");