import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";

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

    // Get schema dynamically, or use fallback
    let columns: Array<{ name: string; type: string }> = [];

    // Try DMMF for columns, then fallback JSON
    const tableSchema = getTableSchema(table);
    if (tableSchema) {
      columns = tableSchema.columns
        .filter((col) => col.kind !== 'object')
        .map((col) => ({ name: col.name, type: col.type }));
    } else {
      const fallbackSchema = await getFallbackSchema(table);
      if (fallbackSchema) {
        columns = Object.entries(fallbackSchema).map(([name, config]) => ({
          name,
          type: config.type,
        }));
      }
      // If both fail, columns stays empty — we'll derive from row data below
    }

    // ControlAssignment gets a computed "ControlID" display column
    if (table === 'ControlAssignment' && !columns.some((c) => c.name === 'ControlID')) {
      const controlIdIndex = columns.findIndex((c) => c.name === 'controlId');
      const insertAt = controlIdIndex >= 0 ? controlIdIndex + 1 : columns.length;
      columns = [
        ...columns.slice(0, insertAt),
        { name: 'ControlID', type: 'String' },
        ...columns.slice(insertAt),
      ];
    }

    let rows: any[] = [];
    let totalRows = 0;

    // Generic fetch — works for any Prisma model
    const camelName = table.charAt(0).toLowerCase() + table.slice(1);

    // Build optional where clause from query params (e.g. ?controlId=xxx)
    const url = new URL(request.url);
    const where: Record<string, string> = {};
    url.searchParams.forEach((val, key) => {
      if (key !== "page" && key !== "perPage") where[key] = val;
    });

    try {
      const model = (prisma as any)[camelName];
      if (!model) {
        return NextResponse.json({ error: `Unknown table: ${table}` }, { status: 404 });
      }

      rows = Object.keys(where).length > 0
        ? await model.findMany({ where })
        : await model.findMany();
      totalRows = rows.length;

      // ControlAssignment: resolve controlRef/name into a human-readable ControlID
      if (table === 'ControlAssignment') {
        const assignments = await prisma.controlAssignment.findMany({
          include: { control: { select: { controlRef: true, name: true } } },
        });
        rows = assignments.map((a: any) => ({
          id: a.id,
          assessmentId: a.assessmentId,
          controlId: a.controlId,
          ControlID: a.control?.controlRef || a.control?.name || a.controlId,
          effective: a.effective,
          effectiveUpdatedAt: a.effectiveUpdatedAt,
          createdAt: a.createdAt,
        }));
        totalRows = assignments.length;
      }
    } catch (err: any) {
      console.error(`Error fetching ${table}:`, err.message);
    }

    // Prefer row-derived columns over stale DMMF — always accurate
    if (rows.length > 0) {
      const sample = rows[0];
      columns = Object.keys(sample).map((key) => ({
        name: key,
        type: typeof sample[key] === 'number' ? 'Int'
            : sample[key] instanceof Date ? 'DateTime'
            : typeof sample[key] === 'boolean' ? 'Boolean'
            : 'String',
      }));
    }

    // ControlAssignment: ensure ControlID display column is after controlId
    if (table === 'ControlAssignment' && !columns.some((c) => c.name === 'ControlID')) {
      const idx = columns.findIndex((c) => c.name === 'controlId');
      columns.splice(idx >= 0 ? idx + 1 : columns.length, 0, { name: 'ControlID', type: 'String' });
    }

    // Pagination support
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = parseInt(url.searchParams.get("perPage") || "50");
    const start = (page - 1) * perPage;
    const pagedRows = rows.slice(start, start + perPage);

    return NextResponse.json({
      columns,
      rows: pagedRows,
      totalRows: rows.length,
      page,
      perPage,
      totalPages: Math.ceil(rows.length / perPage),
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const body = await request.json();

    // Only validate name for tables that have a name field
    const tablesNeedingName = ["SampleType", "RecordSourceType", "ProcessArea", "SubProcess", "AssuranceActivityType"];
    const name: string | undefined = body.name;
    if (tablesNeedingName.includes(table)) {
      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json(
          { error: "Name is required and must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    let result: any;

    switch (table) {
      case 'SampleType': {
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
        const existing = await prisma.sampleType.findUnique({
          where: { name: name.trim() },
        });
        if (existing) {
          return NextResponse.json(
            { error: 'Sample type already exists' },
            { status: 409 }
          );
        }
        result = await prisma.sampleType.create({
          data: { name: name.trim() },
        });
        break;
      }
      case 'RecordSourceType': {
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
        const existing = await prisma.recordSourceType.findUnique({
          where: { name: name.trim() },
        });
        if (existing) {
          return NextResponse.json(
            { error: 'Record source already exists' },
            { status: 409 }
          );
        }
        result = await prisma.recordSourceType.create({
          data: { name: name.trim() },
        });
        break;
      }
      default: {
        // Generic create — works for any table
        const camelName = table.charAt(0).toLowerCase() + table.slice(1);
        const model = (prisma as any)[camelName];
        if (!model) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
        result = await model.create({ data: body });
        break;
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating entry:', error);
    return NextResponse.json(
      { error: 'Failed to create entry' },
      { status: 500 }
    );
  }
}
