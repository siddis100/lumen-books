import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by `drizzle-kit migrate|generate`. Reads DATABASE_URL from .env.local.
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/lumen",
  },
  verbose: true,
  strict: true,
} satisfies Config;