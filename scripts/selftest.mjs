#!/usr/bin/env node
/**
 * Integration checks against a real database and a running server.
 *
 * `npm run check` proves the project builds. It does not prove that the money
 * adds up or that a paid customer is the only one who can download a file.
 * Those are the two things that cannot be wrong, and neither is reachable from
 * a type checker, so they are exercised here over real HTTP.
 *
 * What it needs:
 *   - `DATABASE_URL` and `DOWNLOAD_LINK_SECRET` (or `CRON_SECRET`) in .env.local
 *   - the app running on http://127.0.0.1:3000  (`npm run dev`)
 *
 * Every check creates its own fixtures and removes them on the way out,
 * including after a failure. Fixtures are tagged `zz-selftest-` so a crashed
 * run can be swept with `--clean`.
 *
 * Exits 0 when everything passes, 1 otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const postgres = require("postgres");

const ROOT = process.cwd();
const BASE = process.env.SELFTEST_BASE ?? "http://127.0.0.1:3000";
const TAG = "zz-selftest-";
const PROMO_TAG = "ZZTEST";
const EMAIL = "zz-selftest@example.com";

// Chosen so the cent arithmetic is interesting: 1999 * 10% = 199.9, which must
// land on 200, and 590 + 690 = 1280 clears the 1000-cent promo floor while 590
// alone does not.
const PRICES = [590, 690, 790, 1999];

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/**
 * Reads one variable out of a dotenv file without printing it.
 *
 * The application reads .env.local through Next.js; this script talks to the
 * database directly, so it needs the same values. Nothing here ever reaches the
 * console.
 */
function secretFrom(name) {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const raw of fs.readFileSync(full, "utf8").split(NL)) {
      const line = raw.replace(CR, "").trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      if (line.slice(0, eq).trim() !== name) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }
  return undefined;
}

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}`);
    console.log(`        got      ${JSON.stringify(actual)}`);
  }
}

function heading(title) {
  console.log(`\n--- ${title} ---`);
}

async function post(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* error response with no JSON body */
  }
  return { status: res.status, json };
}

async function get(url) {
  const res = await fetch(url, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
}

const databaseUrl = secretFrom("DATABASE_URL");
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}
const linkSecret = secretFrom("DOWNLOAD_LINK_SECRET") ?? secretFrom("CRON_SECRET");
const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require" });

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** Removes every row this script may have created, children before parents. */
async function cleanup() {
  await sql`
    delete from downloads
    where order_item_id in (
      select id from order_items
      where order_id in (select id from orders where order_number like ${"ZZSELFTEST-%"})
         or book_id in (select id from books where slug like ${TAG + "%"})
    )
  `;
  await sql`
    delete from order_items
    where order_id in (select id from orders where order_number like ${"ZZSELFTEST-%"})
       or book_id in (select id from books where slug like ${TAG + "%"})
  `;
  await sql`delete from orders where order_number like ${"ZZSELFTEST-%"}`;
  await sql`delete from promo_codes where code like ${PROMO_TAG + "%"}`;
  const rows = await sql`delete from books where slug like ${TAG + "%"} returning slug`;
  return rows.length;
}

/**
 * Books with a file behind them, which is what makes them sellable. The demo
 * titles shipped in the seed have no upload, and `priceOrder` correctly refuses
 * to charge for a title with no file — so they cannot be used to test pricing.
 */
async function createBooks() {
  const created = new Map();
  for (const price of PRICES) {
    const [row] = await sql`
      insert into books (slug, title, author, description, price_cents, currency,
                         formats, pdf_path, is_active, is_demo)
      values (
        ${`${TAG}${price}`}, ${`Selftest fixture ${price}`}, ${"Selftest Author"},
        ${"Temporary fixture created by scripts/selftest.mjs."},
        ${price}, ${"USD"}, ${sql.array(["epub", "pdf"])},
        ${`fixtures/${TAG}${price}.pdf`}, ${true}, ${false}
      )
      returning id, price_cents
    `;
    created.set(price, row.id);
  }

  const [inactive] = await sql`
    insert into books (slug, title, author, description, price_cents, currency,
                       formats, pdf_path, is_active, is_demo)
    values (
      ${`${TAG}inactive`}, ${"Selftest fixture unpublished"}, ${"Selftest Author"},
      ${"Temporary fixture created by scripts/selftest.mjs."},
      990, ${"USD"}, ${sql.array(["epub", "pdf"])},
      ${`fixtures/${TAG}inactive.pdf`}, ${false}, ${false}
    )
    returning id
  `;
  created.set("inactive", inactive.id);
  return created;
}

/** WELCOME10 is created by the seed with a 1000-cent floor and a 10% discount. */
async function resetRateLimits() {
  const rows = await sql`
    delete from rate_limits
    where key like ${"checkout:%"} or key like ${"download:%"} or key like ${"cart-price:%"}
  `;
  return rows.length;
}

async function countOrders() {
  return Number((await sql`select count(*)::int as n from orders`)[0].n);
}

/* -------------------------------------------------------------------------- */
/* Cart pricing                                                               */
/* -------------------------------------------------------------------------- */

async function testPricing(ids) {
  const A = ids.get(590);
  const B = ids.get(690);
  const C = ids.get(790);
  const D = ids.get(1999);

  heading("cart pricing, in cents");
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }] });
    check("590 x1 -> subtotal 590, discount 0, total 590", [json.subtotalCents, json.discountCents, json.totalCents], [590, 0, 590]);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 3 }] });
    check("590 x3 -> 1770", [json.subtotalCents, json.totalCents], [1770, 1770]);
    check("quantity echoed back", json.lines[0].quantity, 3);
    check("unit price comes from the database", json.lines[0].unitPriceCents, 590);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }, { bookId: B, quantity: 2 }] });
    check("590 + 690x2 = 1970", json.subtotalCents, 1970);
    check("two lines", json.lines.length, 2);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }, { bookId: B, quantity: 1 }, { bookId: C, quantity: 1 }] });
    check("590+690+790 = 2070", json.subtotalCents, 2070);
  }

  heading("WELCOME10: 10% off, 1000-cent floor, 100 uses");
  {
    // A genuine code that simply does not apply yet. It must not be reported as
    // bogus: the response has to carry the threshold so the cart can say how
    // much more is needed.
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }], promoCode: "WELCOME10" });
    check("590 alone: no discount", [json.subtotalCents, json.discountCents, json.totalCents], [590, 0, 590]);
    check("under-floor: promoValid false", json.promoValid, false);
    check("under-floor: threshold exposed", json.promoMinSubtotalCents, 1000);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }, { bookId: B, quantity: 1 }], promoCode: "WELCOME10" });
    check("1280 -10% = 128, total 1152", [json.subtotalCents, json.discountCents, json.totalCents], [1280, 128, 1152]);
    check("promoValid true", json.promoValid, true);
    check("threshold absent once satisfied", json.promoMinSubtotalCents, null);
    check("code echoed", json.promoCode, "WELCOME10");
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: C, quantity: 4 }], promoCode: "WELCOME10" });
    check("790x4 = 3160, -316, total 2844", [json.subtotalCents, json.discountCents, json.totalCents], [3160, 316, 2844]);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: D, quantity: 1 }], promoCode: "WELCOME10" });
    check("1999 rounds the discount up to 200, total 1799", [json.discountCents, json.totalCents], [200, 1799]);
    check("discount never exceeds the subtotal", json.discountCents <= json.subtotalCents, true);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }, { bookId: B, quantity: 1 }], promoCode: "NOPE" });
    check("unknown code: promoValid false, no discount", [json.promoValid, json.discountCents, json.totalCents], [false, 0, 1280]);
    // Echoing the typed value is deliberate, so the shopper can spot the typo.
    check("unknown code echoes what was typed", json.promoCode, "NOPE");
    check("unknown code carries no threshold", json.promoMinSubtotalCents, null);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: D, quantity: 1 }], promoCode: "  welcome10  " });
    check("padded lowercase code still applies", [json.promoValid, json.discountCents], [true, 200]);
  }

  heading("the client must not talk the server into a number");
  for (const [label, quantity] of [
    ["quantity 0", 0],
    ["quantity 11, the maximum is 10", 11],
    ["negative quantity", -3],
    ["fractional quantity", 1.5],
  ]) {
    const { status } = await post("/api/cart/price", { items: [{ bookId: A, quantity }] });
    check(`${label} rejected with 422`, status, 422);
  }
  {
    const { status } = await post("/api/cart/price", { items: [{ bookId: "not-a-uuid", quantity: 1 }] });
    check("bogus uuid rejected with 422", status, 422);
  }
  {
    // The route has no price field at all: the schema strips it.
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1, priceCents: 1 }] });
    check("client price ignored, real price charged", [json.subtotalCents, json.totalCents], [590, 590]);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1, unitPriceCents: 0 }] });
    check("client unit price ignored", json.subtotalCents, 590);
  }
  {
    const { status } = await post("/api/cart/price", { items: [] });
    check("empty cart rejected with 422", status, 422);
  }
  {
    const { json } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }, { bookId: A, quantity: 1 }] });
    const quantity = json.lines.reduce((sum, line) => sum + line.quantity, 0);
    check("repeated lines cannot inflate quantity past 2", quantity, 2);
    check("repeated lines still total 1180", json.subtotalCents, 1180);
  }
  {
    const { status } = await post("/api/cart/price", { items: [{ bookId: "00000000-0000-0000-0000-000000000000", quantity: 1 }] });
    check("unknown book id -> 409, never a silent zero", status, 409);
  }
  {
    const { status } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }], promoCode: "x".repeat(41) });
    check("41-character promo rejected with 422", status, 422);
  }
  {
    const { status } = await post("/api/cart/price", { items: [{ bookId: A, quantity: 1 }], promoCode: { $ne: null } });
    check("non-string promo rejected with 422", status, 422);
  }
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                    */
/* -------------------------------------------------------------------------- */

async function testCheckout(ids) {
  const A = ids.get(590);
  const B = ids.get(1290) ?? ids.get(690);

  // Two extra codes so expiry and exhaustion can be exercised without touching
  // the shipped WELCOME10.
  await sql`
    insert into promo_codes (code, kind, value, min_subtotal_cents, expires_at, is_active)
    values (${`${PROMO_TAG}EXPIRED`}, ${"percent"}, 50, 0, ${"2020-01-01T00:00:00Z"}, ${true})
  `;
  await sql`
    insert into promo_codes (code, kind, value, min_subtotal_cents, max_uses, used_count, is_active)
    values (${`${PROMO_TAG}USEDUP`}, ${"percent"}, 50, 0, 5, 5, ${true})
  `;

  const ordersBefore = await countOrders();
  // `terms` is a required literal true on the real checkout form.
  const checkout = (body) => post("/api/checkout", { terms: true, email: EMAIL, locale: "en", ...body });

  heading("promo refusals must name the real reason");
  {
    const { status, json } = await checkout({ items: [{ bookId: A, quantity: 1 }], promoCode: "WELCOME10" });
    check("valid code, basket under the floor -> promo_min_subtotal", json.error, "promo_min_subtotal");
    check("  status 422", status, 422);
  }
  {
    const { json } = await checkout({ items: [{ bookId: A, quantity: 1 }], promoCode: "NOPE" });
    check("code that does not exist -> promo_invalid", json.error, "promo_invalid");
  }
  {
    const { json } = await checkout({ items: [{ bookId: A, quantity: 1 }], promoCode: `${PROMO_TAG}EXPIRED` });
    check("expired code -> promo_expired, not promo_invalid", json.error, "promo_expired");
  }
  {
    const { json } = await checkout({ items: [{ bookId: A, quantity: 1 }], promoCode: `${PROMO_TAG}USEDUP` });
    check("exhausted code -> promo_invalid", json.error, "promo_invalid");
  }
  {
    // No promo and a valid cart: this reaches PayPal and fails on credentials,
    // which is expected while PAYPAL_CLIENT_SECRET is still the example.
    const { status, json } = await checkout({ items: [{ bookId: A, quantity: 1 }] });
    check("no promo: fails later, on PayPal", json.ok ?? false, false);
    check("  reported as checkout_unavailable", json.error, "checkout_unavailable");
    check("  with 503, not 500", status, 503);
  }

  heading("a refused request must leave no trace in orders");
  check("no new order rows", await countOrders(), ordersBefore);

  heading("checkout payload validation");
  for (const [label, body] of [
    ["missing email", { locale: "en", items: [{ bookId: A, quantity: 1 }] }],
    ["malformed email", { email: "nope", locale: "en", items: [{ bookId: A, quantity: 1 }] }],
    ["unknown locale", { email: EMAIL, locale: "de", items: [{ bookId: A, quantity: 1 }] }],
    ["empty items", { email: EMAIL, locale: "en", items: [] }],
    ["quantity above the cap", { email: EMAIL, locale: "en", items: [{ bookId: A, quantity: 99 }] }],
    ["terms not accepted", { email: EMAIL, locale: "en", items: [{ bookId: A, quantity: 1 }], terms: false }],
  ]) {
    const { status } = await post("/api/checkout", { terms: true, ...body });
    check(`${label} rejected with 422`, status, 422);
  }
  {
    const { json } = await checkout({ items: [{ bookId: B, quantity: 1, priceCents: 1 }] });
    check("client price ignored on checkout too", json.ok ?? false, false);
  }
  check("still no order rows after the run", await countOrders(), ordersBefore);
}

/* -------------------------------------------------------------------------- */
/* Downloads                                                                   */
/* -------------------------------------------------------------------------- */

/** Mints a guest link with the same HMAC the application uses. */
function token(orderItemId, ttlSeconds, secret = linkSecret) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const value = `${orderItemId}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

async function testDownloads(ids) {
  if (!linkSecret) {
    console.log("\nSKIP  downloads: no DOWNLOAD_LINK_SECRET or CRON_SECRET set");
    return;
  }

  const bookId = ids.get(590);
  const inactiveId = ids.get("inactive");

  let counter = 0;
  async function makeOrder(state) {
    counter += 1;
    const status = state === "pending" ? "pending" : "paid";
    const confirmed = state === "paid" ? new Date() : null;
    const [order] = await sql`
      insert into orders (order_number, email, locale, status, subtotal_cents,
                         total_cents, currency, webhook_confirmed_at)
      values (${`ZZSELFTEST-${state}-${counter}`}, ${EMAIL}, ${"en"}, ${status},
              590, 590, ${"USD"}, ${confirmed})
      returning id
    `;
    const [item] = await sql`
      insert into order_items (order_id, book_id, title_snapshot, author_snapshot,
                               unit_price_cents, quantity, line_total_cents)
      values (${order.id}, ${bookId}, ${"Selftest fixture 590"}, ${"Selftest Author"}, 590, 1, 590)
      returning id
    `;
    return { orderId: order.id, itemId: item.id };
  }

  const download = (orderItemId, tok) =>
    get(`${BASE}/api/downloads/${orderItemId}${tok ? `?token=${encodeURIComponent(tok)}` : ""}`);

  const pending = await makeOrder("pending");
  const noWebhook = await makeOrder("no_webhook");
  const paid = await makeOrder("paid");

  heading("downloads: only the buyer gets the file");
  {
    const { status } = await download(pending.itemId, token(pending.itemId, 3600));
    check("pending order refused even with a valid token", status, 404);
  }
  {
    const { status } = await download(noWebhook.itemId, token(noWebhook.itemId, 3600));
    check("paid but never webhook-confirmed refused", status, 404);
  }
  {
    const { status } = await download(paid.itemId);
    check("paid order refused with no token and no session", status, 404);
  }
  {
    // The file was never uploaded, so the storage call fails and the route
    // answers 404. A 302 would mean it handed out a signed URL.
    const { status } = await download(paid.itemId, token(paid.itemId, 3600));
    check("genuine link on a paid, confirmed order gets past authorisation", [status === 404 || status === 302], [true]);
  }

  heading("downloads: forged, tampered and replayed links");
  {
    const { status } = await download(paid.itemId, token(paid.itemId, 3600, "the-wrong-secret"));
    check("signature made with the wrong secret refused", status, 404);
  }
  {
    const parts = token(paid.itemId, 3600).split(".");
    const { status } = await download(paid.itemId, `${parts[0]}.${parts[1]}.${"A".repeat(parts[2].length)}`);
    check("signature tampered refused", status, 404);
  }
  {
    const future = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
    const { status } = await download(paid.itemId, `${paid.itemId}.${future}.${"B".repeat(43)}`);
    check("expiry pushed a decade forward with a bad signature refused", status, 404);
  }
  {
    const { status } = await download(paid.itemId, token(paid.itemId, -10));
    check("expired token refused", status, 404);
  }
  {
    // A genuine token, but minted for a different order item.
    const { status } = await download(paid.itemId, token(noWebhook.itemId, 3600));
    check("token minted for another order item refused", status, 404);
  }
  for (const [label, tok] of [
    ["empty token", ""],
    ["no signature", `${paid.itemId}.${Math.floor(Date.now() / 1000) + 3600}`],
    ["extra segments", `${paid.itemId}.123.sig.extra`],
    ["non-numeric expiry", `${paid.itemId}.notanumber.sig`],
    ["negative expiry", `${paid.itemId}.-123.sig`],
  ]) {
    const { status } = await download(paid.itemId, tok);
    check(`${label} refused`, status, 404);
  }

  heading("downloads: nothing is enumerable");
  {
    const { status } = await download("00000000-0000-0000-0000-000000000000", token("00000000-0000-0000-0000-000000000000", 3600));
    check("unknown order item answers 404, not 403 or 500", status, 404);
  }
  {
    const { status } = await download("not-a-uuid", "x.y.z");
    check("malformed id answers 404", status, 404);
  }
  {
    const [item] = await sql`
      insert into order_items (order_id, book_id, title_snapshot, author_snapshot,
                               unit_price_cents, quantity, line_total_cents)
      values (${paid.orderId}, ${inactiveId}, ${"Unpublished fixture"}, ${"Selftest Author"}, 590, 1, 590)
      returning id
    `;
    const { status } = await download(item.id, token(item.id, 3600));
    check("unpublished book refused even on a paid order", status, 404);
  }
}

/* -------------------------------------------------------------------------- */

async function main() {
  if (process.argv[2] === "--clean") {
    console.log(`removed ${await cleanup()} fixture books`);
    console.log(`cleared ${await resetRateLimits()} rate-limit rows`);
    return;
  }

  const alive = await fetch(`${BASE}/api/search?q=selftest`).then(
    () => true,
    () => false,
  );
  if (!alive) {
    console.error(`no server answering at ${BASE}. Start it with: npm run dev`);
    process.exit(1);
  }

  console.log(`selftest against ${BASE}`);
  await cleanup();
  console.log(`cleared ${await resetRateLimits()} rate-limit rows`);

  try {
    const ids = await createBooks();
    await testPricing(ids);
    await testCheckout(ids);
    await testDownloads(ids);
  } finally {
    // Always sweep, including after a thrown error: a crashed run must not
    // leave fake books in a catalogue that a customer might see.
    const removed = await cleanup();
    console.log(`\nfixtures removed: ${removed}`);
  }

  console.log(
    failures === 0
      ? `All ${checks} checks passed.`
      : `${failures} of ${checks} checks failed.`,
  );
}

main()
  .then(async () => {
    await sql.end();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });