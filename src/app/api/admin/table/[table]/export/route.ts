import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { table } = await params;

    // Get schema dynamically or use fallback
    let columns: string[] = [];

    const tableSchema = getTableSchema(table);
    if (tableSchema) {
      columns = tableSchema.columns
        .filter((col) => col.kind !== 'object')
        .map((col) => col.name);
    } else {
      // Use fallback schema
      const fallbackSchema = await getFallbackSchema(table);
      if (!fallbackSchema) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }
      columns = Object.keys(fallbackSchema);
    }

    let data: any[] = [];

    // Fetch data based on table using generic approach
    try {
      const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
      if (!model) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }
      data = await model.findMany();
    } catch (e) {
      return NextResponse.json({ error: 'Error fetching table data' }, { status: 500 });
    }

    // Generate CSV
    const csvLines: string[] = [];

    // Add header row
    csvLines.push(columns.map(escapeCSV).join(','));

    // Add data rows
    for (const row of data) {
      const values = columns.map((col) => escapeCSV(row[col]));
      csvLines.push(values.join(','));
    }

    const csv = csvLines.join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}_export.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting table:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
