import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    // Refresh PostgreSQL statistics so n_live_tup is accurate (avoid stale 0 counts)
    await prisma.$executeRawUnsafe(`ANALYZE`);

    const tables = await prisma.$queryRawUnsafe<
      Array<{ table_name: string; row_estimate: number }>
    >(`
      SELECT t.table_name,
        COALESCE((SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.table_name), 0)::int AS row_estimate
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name NOT LIKE '_prisma_%'
      ORDER BY t.table_name
    `);
    return NextResponse.json({ tables });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;
    const { table, action } = await request.json();
    if (!table) return NextResponse.json({ error: "table required" }, { status: 400 });
    if (action === "drop") {
      if (["User","ActivityLog"].includes(table)) return NextResponse.json({ error: "Protected" }, { status: 400 });
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
