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

    const tableSchema = getTableSchema(table);
    if (tableSchema) {
      columns = tableSchema.columns
        .filter((col) => col.kind !== 'object')
        .map((col) => ({ name: col.name, type: col.type }));
    } else {
      // Use fallback schema (now async)
      const fallbackSchema = await getFallbackSchema(table);
      if (!fallbackSchema) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }
      columns = Object.entries(fallbackSchema).map(([name, config]) => ({
        name,
        type: config.type,
      }));
    }

    // ControlAssignment gets a computed "ControlID" display column resolved
    // from the linked Control (its controlRef/name), inserted right after
    // the raw controlId column. It is not a real DB column — the create/
    // update routes ignore it — it exists purely so the table view shows a
    // human-readable control identifier instead of the raw internal id.
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

    // Fetch data from database (no limit - get all records)
    switch (table) {
      case 'User':
        rows = await prisma.user.findMany();
        totalRows = await prisma.user.count();
        break;
      case 'ProcessArea':
        rows = await prisma.processArea.findMany();
        totalRows = await prisma.processArea.count();
        break;
      case 'SubProcess':
        rows = await prisma.subProcess.findMany();
        totalRows = await prisma.subProcess.count();
        break;
      case 'Control':
        rows = await prisma.control.findMany();
        totalRows = await prisma.control.count();
        break;
      case 'Assessment':
        rows = await prisma.assessment.findMany();
        totalRows = await prisma.assessment.count();
        break;
      case 'ControlAssignment': {
        const assignments = await prisma.controlAssignment.findMany({
          include: { control: { select: { controlRef: true, name: true } } },
        });
        rows = assignments.map((a) => ({
          id: a.id,
          assessmentId: a.assessmentId,
          controlId: a.controlId,
          ControlID: a.control?.controlRef || a.control?.name || a.controlId,
          effective: a.effective,
          effectiveUpdatedAt: a.effectiveUpdatedAt,
          createdAt: a.createdAt,
        }));
        totalRows = assignments.length;
        break;
      }
      case 'Sample':
        rows = await prisma.sample.findMany();
        totalRows = await prisma.sample.count();
        break;
      case 'AssuranceActivityType':
        rows = await prisma.assuranceActivityType.findMany();
        totalRows = await prisma.assuranceActivityType.count();
        break;
      case 'SampleType':
        rows = await prisma.sampleType.findMany({ orderBy: { name: 'asc' } });
        totalRows = await prisma.sampleType.count();
        break;
      case 'RecordSourceType':
        rows = await prisma.recordSourceType.findMany({ orderBy: { name: 'asc' } });
        totalRows = await prisma.recordSourceType.count();
        break;
    }

    return NextResponse.json({
      columns,
      rows,
      totalRows,
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
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    let result: any;

    switch (table) {
      case 'SampleType': {
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
      default:
        return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
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
