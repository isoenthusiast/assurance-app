import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";

/**
 * Generate sample data for CSV template based on actual table schema
 */
function generateSampleValue(fieldName: string, fieldType: string): string {
  // Relationship fields - use reasonable IDs
  if (fieldName.endsWith('Id') && fieldType === 'String') {
    const prefix = fieldName.replace('Id', '').toLowerCase();
    return `${prefix}_001`;
  }

  // Boolean fields
  if (fieldType === 'Boolean') {
    return 'true';
  }

  // Integer fields
  if (fieldType === 'Int') {
    return '1';
  }

  // DateTime fields
  if (fieldType === 'DateTime') {
    return '2026-06-23T10:00:00Z';
  }

  // Field-specific samples
  const samples: Record<string, string> = {
    id: `id_${Date.now()}`,
    name: 'Example Name',
    username: 'example_user',
    passwordHash: 'hashed_password_here',
    role: 'Assessor',
    description: 'Example description',
    statement: 'This is an example statement',
    controlType: 'Administrative',
    controlName: 'Example Control',
    controlStatement: 'Example control statement',
    controlRef: 'CTRL-001',
    sourceFile: '01 Example',
    practiceDocument: 'Practice.md',
    processAreaId: 'pa_001',
    subProcessId: 'sp_001',
    assessmentId: 'assess_001',
    commentText: 'Example comment',
    status: 'Active',
    conclusion: 'Compliant',
    evidenceUrl: 'https://example.com/evidence',
    startDate: '2026-06-23T10:00:00Z',
    endDate: '2026-06-30T10:00:00Z',
    loa: 'LOA 3',
    csfWho: 'Process Owner',
    csfWhat: 'Execute control procedure',
    csfWhen: 'Ongoing',
    csfWhere: 'Asset level',
    csfWhy: 'Risk mitigation',
    csfHow: 'Through documented process',
    csfEvidence: 'Process records',
    keyActivities: 'Activity 1 | Activity 2',
    riskAddressed: 'Process safety risk',
    testingApproach: 'Document review and testing',
    uncertainFlags: 'None',
    ramRating: 'Yellow',
    riskWeight: '1',
    rawHealthScore: '85',
    lastTestedDate: '2026-06-15T10:00:00Z',
    lastTestResult: 'Pass',
  };

  return samples[fieldName] || 'Sample Data';
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

    const { table } = await params;

    // Get schema dynamically, with fallback
    interface ColInfo { name: string; type: string }
    let colInfos: ColInfo[] = [];

    const tableSchema = getTableSchema(table);
    if (tableSchema) {
      colInfos = tableSchema.columns
        .filter((col) => col.kind !== 'object')
        .map((col) => ({ name: col.name, type: col.type }));
    } else {
      // Use fallback schema
      const fallbackSchema = getFallbackSchema(table);
      if (!fallbackSchema) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }
      colInfos = Object.entries(fallbackSchema).map(([name, config]) => ({
        name, type: config.type,
      }));
    }

    if (colInfos.length === 0) {
      return NextResponse.json({ error: 'No columns found for this table' }, { status: 404 });
    }

    // Build CSV: header row + one sample row
    const headerLine = colInfos.map((c) => escapeCSV(c.name)).join(',');
    const sampleLine = colInfos.map((c) => {
      const val = generateSampleValue(c.name, c.type);
      return escapeCSV(val);
    }).join(',');

    const csv = `${headerLine}\n${sampleLine}\n`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}_template.csv"`,
      },
    });
  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
