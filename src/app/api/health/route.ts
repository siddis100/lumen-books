import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the platform and for uptime monitoring.
 *
 * Only the verdict leaves the server: connection details stay in the logs so a
 * public endpoint cannot be used to fingerprint the database.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("[health] database unreachable:", (error as Error).message);
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
