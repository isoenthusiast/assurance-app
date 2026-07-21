import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";

export async function GET(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    // Get list of all tables from PostgreSQL
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );

    // Get row and column counts for each table
    const tableInfo = await Promise.all(
      tables.map(async (table) => {
        try {
          // Count rows
          const rowCountResult = await prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
            `SELECT COUNT(*) as count FROM "${table.name}"`
          );
          const rowCount = Number(rowCountResult[0]?.count) || 0;

          // Get columns
          const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
            `SELECT column_name FROM information_schema.columns WHERE table_name = '${table.name}' AND table_schema = 'public'`
          );
          const columnCount = columns.length;

          return {
            name: table.name,
            columnCount,
            rowCount,
          };
        } catch (err) {
          console.error(`Error getting info for table ${table.name}:`, err);
          return {
            name: table.name,
            columnCount: 0,
            rowCount: 0,
          };
        }
      })
    );

    return NextResponse.json(tableInfo);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: `Failed to fetch tables: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    // Validate table name (alphanumeric + underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { error: "Invalid table name. Use only alphanumeric characters and underscores." },
        { status: 400 }
      );
    }

    // Check if table already exists
    const existing = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${name}'`
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Table '${name}' already exists` },
        { status: 409 }
      );
    }

    // Create basic table with id and createdAt columns
    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${name}" (
        "id" TEXT PRIMARY KEY,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    return NextResponse.json(
      { success: true, message: `Table '${name}' created` },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}
