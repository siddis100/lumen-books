import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.execute(sql`select 1 as ok`);
    return Response.json({ ok: true, rows: rows.length });
  } catch (error) {
    return Response.json(
      { ok: false, name: (error as Error).name, message: (error as Error).message },
      { status: 503 },
    );
  }
}
