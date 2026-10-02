import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle client for Supabase Postgres.
 *
 * We connect over the Supabase connection pooler (or the direct host) with the
 * project `postgres` role, which owns the tables and therefore bypasses RLS.
 * RLS stays active for the `anon` / `authenticated` roles, so any direct browser
 * access remains locked down — see `db/migrations/0000_init.sql`.
 *
 * Why Drizzle over Prisma: it is a thin, SQL-shaped layer with excellent
 * TypeScript inference, no query engine to ship, and it connects to Supabase's
 * pooler as a plain `postgres` client (no binary engines on Vercel).
 */

export type Db = PostgresJsDatabase<typeof schema>;

declare global {
  var __lumenDb__: { sql: postgres.Sql; db: Db } | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env.local and fill in the Supabase Postgres connection string.",
    );
  }

  const sql = postgres(url, {
    // Serverless-safe pooling: keep the pool small and close eagerly.
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
  });

  return { sql, db: drizzle(sql, { schema }) };
}

function resolve(): { sql: postgres.Sql; db: Db } {
  // Reuse the connection across hot reloads / serverless invocations.
  if (globalThis.__lumenDb__) return globalThis.__lumenDb__;
  const client = createClient();
  if (process.env.NODE_ENV !== "production") globalThis.__lumenDb__ = client;
  return client;
}

/**
 * Lazily-created database handle.
 *
 * The client is a Proxy so importing this module never throws: the connection is
 * only opened on the first real property access. That keeps `next build` working
 * on a fresh clone (no secrets yet) while still failing loudly at runtime the
 * moment a query is actually issued.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    const instance = resolve().db as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(resolve().db as object, property);
  },
}) as Db;

/** Direct access to the underlying `postgres` client (transactions, raw SQL). */
export function getSql() {
  return resolve().sql;
}

export { schema };
export type { PostgresJsDatabase };
