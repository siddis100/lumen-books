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
    return { tree: JSON.parse(raw), raw };
  } catch (error) {
    console.error(`${locale}.json is not valid JSON: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Lists keys that appear more than once in the same object.
 *
 * JSON.parse cannot help here: when a key is repeated, the last one wins and
 * the earlier one disappears without a word. Comparing key trees therefore
 * passes, and the translation that gets shipped is whichever happened to be
 * written second. Since ICU messages are full of `{placeholders}`, this walks
 * the raw text with a brace-aware scanner rather than trying to parse it.
 */
function duplicateKeys(raw) {
  const seen = new Map();
  const duplicates = [];
  // Frames describe what is currently open: an object contributes its key, an
  // array contributes its key plus an index. Without the index every element of
  // a `sections` array lands on the same path and looks like a duplicate.
  const stack = [{ kind: "object", key: null }];
  let pendingKey = null;
  let i = 0;

  const pathTo = (key) =>
    stack
      .map((frame) =>
        frame.kind === "array" ? `${frame.key}[${frame.index}]` : frame.key,
      )
      .filter((part) => part !== null)
      .concat(key)
      .join(".");

  while (i < raw.length) {
    const char = raw[i];

    if (char === '"') {
      let j = i + 1;
      let text = "";
      while (j < raw.length && raw[j] !== '"') {
        if (raw[j] === "\\") {
          text += raw[j + 1] ?? "";
          j += 2;
          continue;
        }
        text += raw[j];
        j += 1;
      }
      // A string followed by a colon is an object key, not a value.
      let after = j + 1;
      while (after < raw.length && /\s/.test(raw[after])) after += 1;
      if (raw[after] === ":") {
        const full = pathTo(text);
        const count = (seen.get(full) ?? 0) + 1;
        seen.set(full, count);
        if (count === 2) duplicates.push(full);
        pendingKey = text;
        i = j + 1;
        continue;
      }
      i = j + 1;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char === "{" ? { kind: "object", key: pendingKey } : { kind: "array", key: pendingKey, index: 0 });
      pendingKey = null;
      i += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      stack.pop();
      i += 1;
      continue;
    }

    if (char === ",") {
      const top = stack[stack.length - 1];
      if (top && top.kind === "array") top.index += 1;
      pendingKey = null;
    }
    i += 1;
  }

  return duplicates;
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

const reference = readMessages(REFERENCE);
const referenceKeys = keyTree(reference.tree);
console.log(
  `${REFERENCE}.json: ${referenceKeys.size} leaf keys (reference)\n`,
);

let failures = 0;

const allLocales = [REFERENCE, ...LOCALES];

for (const locale of allLocales) {
  const { raw } = locale === REFERENCE ? reference : readMessages(locale);
  const duplicates = duplicateKeys(raw);
  if (duplicates.length === 0) continue;

  failures += 1;
  console.log(`${locale}.json: ${duplicates.length} duplicate key(s)`);
  for (const key of duplicates) console.log(`  duplicate  ${key}`);
  console.log("");
}

for (const locale of LOCALES) {
  const keys = keyTree(readMessages(locale).tree);
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
    `i18n audit failed for ${failures} check(s). A missing key renders as its raw name on the page, and a duplicate key silently discards the translation written first.`,
  );
  process.exit(1);
}

console.log("\nall locales share the same key tree");