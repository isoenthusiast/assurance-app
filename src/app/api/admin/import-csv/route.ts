import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getFallbackSchema } from "@/lib/fallback-schemas";

// Simple CSV parser
function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

// Convert value to appropriate type
function convertValue(value: string, type: string): any {
  if (!value || value === '') return null;

  switch (type.toLowerCase()) {
    case 'int':
    case 'integer':
      return parseInt(value, 10);
    case 'float':
    case 'decimal':
      return parseFloat(value);
    case 'boolean':
      return value.toLowerCase() === 'true' || value === '1';
    case 'datetime':
      return new Date(value);
    default:
      return value;
  }
}

interface ImportStats {
  success: boolean;
  rowsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Get table schema dynamically from database
 * Returns column names that exist in the actual database table
 */
async function getTableColumns(tableName: string): Promise<string[]> {
  try {
    // Query PostgreSQL information_schema to get actual database columns
    const result = await (prisma as any).$queryRawUnsafe(
      `SELECT column_name as name FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`
    );
    if (Array.isArray(result)) {
      return result.map((col: any) => col.name);
    }
  } catch (error) {
    console.warn(`Could not query database columns for ${tableName}:`, error);
  }

  // Fallback to schema if database query fails
  try {
    const schema = await getFallbackSchema(tableName);
    if (schema) {
      return Object.keys(schema);
    }
  } catch (error) {
    console.warn(`Could not load fallback schema for ${tableName}:`, error);
  }

  return [];
}

/**
 * Build data object for Prisma create
 * Only includes fields that exist in the Prisma model (not just database)
 */
function buildDataObject(
  record: Record<string, any>,
  tableName: string
): Record<string, any> {
  const data: Record<string, any> = {};

  // Whitelists of known fields per table
  const fieldWhitelists: Record<string, string[]> = {
    ProcessArea: [
      'name', 'description', 'pId', 'standard'
    ],
    SubProcess: [
      'name', 'description', 'processAreaId'
    ],
    Control: [
      'name', 'statement', 'controlType', 'controlTypeDetail',
      'processAreaId', 'subProcessId', 'isHsseCritical',
      'sourceFile', 'controlRef', 'practiceDocument',
      'csfWho', 'csfWhat', 'csfWhen', 'csfWhere', 'csfWhy', 'csfHow', 'csfEvidence',
      'keyActivities', 'riskAddressed', 'testingApproach', 'uncertainFlags',
      'ramRating', 'riskWeight', 'rawHealthScore',
      'lastTestedDate', 'lastTestResult',
      'standard', 'pId', 'Requirements'
    ],
    AssuranceActivityType: [
      'name', 'description', 'defaultLOA'
    ],
  };

  const allowedFields = fieldWhitelists[tableName] || [];

  for (const field of allowedFields) {
    const value = record[field];

    // Skip if no value in record
    if (value === undefined || value === null || value === '') {
      // Don't add the field if there's no value
      continue;
    }

    // Type conversions based on field name patterns
    if (field.includes('Date') || field === 'lastTestedDate') {
      data[field] = new Date(value);
    } else if (field === 'riskWeight' || field === 'rawHealthScore') {
      data[field] = parseInt(value, 10);
    } else if (field === 'isHsseCritical') {
      data[field] =
        String(value).toLowerCase() === 'true' ||
        value === '1' ||
        value === 'yes' ||
        value === true;
    } else {
      // Keep as string for other fields
      data[field] = value;
    }
  }

  return data;
}

async function importProcessAreas(rows: string[][]): Promise<ImportStats> {
  const stats: ImportStats = { success: true, rowsImported: 0, errors: [], warnings: [] };
  const [headers, ...dataRows] = rows;

  // Get actual database schema columns
  const schemaColumns = await getTableColumns('ProcessArea');
  console.log(`ProcessArea schema columns: ${schemaColumns.join(', ')}`);

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      const record: Record<string, any> = {};

      headers.forEach((header, idx) => {
        record[header] = row[idx] || null;
      });

      if (!record.name) {
        stats.errors.push(`Row ${i + 2}: Missing required field 'name'`);
        continue;
      }

      // Build data object dynamically based on schema
      const data = buildDataObject(record, 'ProcessArea');
      data.id = `pa_${Date.now()}_${i}`;
      data.name = record.name; // Ensure name is set

      await (prisma.processArea.create as any)({ data });

      stats.rowsImported++;
    } catch (error) {
      stats.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.success = false;
    }
  }

  return stats;
}

async function importSubProcesses(rows: string[][]): Promise<ImportStats> {
  const stats: ImportStats = { success: true, rowsImported: 0, errors: [], warnings: [] };
  const [headers, ...dataRows] = rows;

  // Get actual database schema columns
  const schemaColumns = await getTableColumns('SubProcess');
  console.log(`SubProcess schema columns: ${schemaColumns.join(', ')}`);

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      const record: Record<string, any> = {};

      headers.forEach((header, idx) => {
        record[header] = row[idx] || null;
      });

      if (!record.name || !record.processAreaId) {
        stats.errors.push(`Row ${i + 2}: Missing required fields 'name' or 'processAreaId'`);
        continue;
      }

      // Verify process area exists
      const pa = await prisma.processArea.findUnique({
        where: { id: record.processAreaId },
      });

      if (!pa) {
        stats.warnings.push(`Row ${i + 2}: ProcessArea ${record.processAreaId} not found`);
        continue;
      }

      // Build data object dynamically based on schema
      const data = buildDataObject(record, 'SubProcess');
      data.id = `sp_${Date.now()}_${i}`;
      data.name = record.name; // Ensure required fields
      data.processAreaId = record.processAreaId;

      await (prisma.subProcess.create as any)({ data });

      stats.rowsImported++;
    } catch (error) {
      stats.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.success = false;
    }
  }

  return stats;
}

async function importAssuranceActivityType(rows: string[][]): Promise<ImportStats> {
  const stats: ImportStats = { success: true, rowsImported: 0, errors: [], warnings: [] };
  const [headers, ...dataRows] = rows;
  const VALID_LOAS = ['FirstLine', 'SecondLine', 'ThirdLine'];

  // Get actual database schema columns
  const schemaColumns = await getTableColumns('AssuranceActivityType');
  console.log(`AssuranceActivityType schema columns: ${schemaColumns.join(', ')}`);

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      const record: Record<string, any> = {};

      headers.forEach((header, idx) => {
        record[header] = row[idx] || null;
      });

      if (!record.name) {
        stats.errors.push(`Row ${i + 2}: Missing required field 'name'`);
        continue;
      }

      // Validate LOA field
      const loaValue = record.defaultLOA || record.loa || 'FirstLine';
      if (!VALID_LOAS.includes(loaValue)) {
        stats.errors.push(`Row ${i + 2}: Invalid defaultLOA value '${loaValue}'. Must be one of: ${VALID_LOAS.join(', ')}`);
        continue;
      }

      // Build data object dynamically based on schema
      const data = buildDataObject(record, 'AssuranceActivityType');
      data.name = record.name;
      data.defaultLOA = loaValue;

      await (prisma.assuranceActivityType.create as any)({ data });

      stats.rowsImported++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        stats.warnings.push(`Row ${i + 2}: Activity type '${dataRows[i][0]}' already exists (skipped)`);
      } else {
        stats.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        stats.success = false;
      }
    }
  }

  return stats;
}

async function importControls(rows: string[][]): Promise<ImportStats> {
  const stats: ImportStats = { success: true, rowsImported: 0, errors: [], warnings: [] };
  const [headers, ...dataRows] = rows;

  // Get actual database schema columns
  const schemaColumns = await getTableColumns('Control');
  console.log(`Control schema columns: ${schemaColumns.join(', ')}`);

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      const record: Record<string, any> = {};

      headers.forEach((header, idx) => {
        record[header] = row[idx] || null;
      });

      // Map CSV column names to schema names
      const csvToSchema: Record<string, string> = {
        'controlName': 'name',
        'controlStatement': 'statement',
        'isHSSECritical': 'isHsseCritical',
        'csf_who': 'csfWho',
        'csf_what': 'csfWhat',
        'csf_when': 'csfWhen',
        'csf_where': 'csfWhere',
        'csf_why': 'csfWhy',
        'csf_how': 'csfHow',
        'csf_evidence': 'csfEvidence',
        'controlId': 'controlRef',
      };

      // Remap fields
      Object.keys(csvToSchema).forEach(csvName => {
        if (record[csvName] !== null && record[csvName] !== undefined) {
          record[csvToSchema[csvName]] = record[csvName];
          delete record[csvName];
        }
      });

      // Validate required fields
      const required = ['name', 'statement', 'controlType', 'processAreaId', 'subProcessId'];
      const missing = required.filter(field => !record[field]);

      if (missing.length > 0) {
        stats.errors.push(`Row ${i + 2}: Missing required fields: ${missing.join(', ')}`);
        continue;
      }

      // Verify foreign keys
      const pa = await prisma.processArea.findUnique({
        where: { id: record.processAreaId },
      });

      const sp = await prisma.subProcess.findUnique({
        where: { id: record.subProcessId },
      });

      if (!pa || !sp) {
        stats.warnings.push(`Row ${i + 2}: Invalid ProcessArea or SubProcess ID`);
        continue;
      }

      // Build data object dynamically based on schema
      const data = buildDataObject(record, 'Control');

      // Ensure required fields are set
      data.id = `ctrl_${Date.now()}_${i}`;
      data.name = record.name;
      data.statement = record.statement;
      data.controlType = record.controlType;
      data.processAreaId = record.processAreaId;
      data.subProcessId = record.subProcessId;

      await (prisma.control.create as any)({ data });

      stats.rowsImported++;
    } catch (error) {
      stats.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.success = false;
    }
  }

  return stats;
}

async function importControlAssignments(rows: string[][]): Promise<ImportStats> {
  const stats: ImportStats = { success: true, rowsImported: 0, errors: [], warnings: [] };
  const [headers, ...dataRows] = rows;

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      const record: Record<string, any> = {};

      headers.forEach((header, idx) => {
        record[header] = row[idx] || null;
      });

      if (!record.assessmentId || !record.controlId) {
        stats.errors.push(`Row ${i + 2}: Missing required fields 'assessmentId' or 'controlId'`);
        continue;
      }

      // Verify foreign keys
      const assessment = await prisma.assessment.findUnique({
        where: { id: record.assessmentId },
      });
      const control = await prisma.control.findUnique({
        where: { id: record.controlId },
      });

      if (!assessment || !control) {
        stats.warnings.push(`Row ${i + 2}: Invalid Assessment or Control ID (skipped)`);
        continue;
      }

      const normalizedEffective = String(record.effective || '').trim().toLowerCase();
      const effectiveValue =
        normalizedEffective === 'effective'
          ? 'Effective'
          : normalizedEffective === 'noteffective' || normalizedEffective === 'not effective'
          ? 'NotEffective'
          : null;

      await prisma.controlAssignment.create({
        data: {
          assessmentId: record.assessmentId,
          controlId: record.controlId,
          effective: effectiveValue,
          effectiveUpdatedAt: effectiveValue ? new Date() : null,
        },
      });

      stats.rowsImported++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        stats.warnings.push(`Row ${i + 2}: This control is already assigned to this assessment (skipped)`);
      } else {
        stats.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        stats.success = false;
      }
    }
  }

  return stats;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const table = formData.get('table') as string;

    if (!file || !table) {
      return NextResponse.json(
        { error: 'File and table parameters are required' },
        { status: 400 }
      );
    }

    const text = await file.text();
    let rows = parseCSV(text);

    // Filter out completely empty rows (after header)
    const headers = rows[0];
    const dataRows = rows.slice(1).filter((row) => {
      return row.some((cell, idx) => {
        const header = headers[idx];
        return cell && cell.trim().length > 0;
      });
    });
    rows = [headers, ...dataRows];

    if (rows.length < 2) {
      return NextResponse.json(
        { error: 'CSV must have at least a header row and one data row' },
        { status: 400 }
      );
    }

    let result: ImportStats;

    switch (table) {
      case 'ProcessArea':
        result = await importProcessAreas(rows);
        break;
      case 'SubProcess':
        result = await importSubProcesses(rows);
        break;
      case 'Control':
        result = await importControls(rows);
        break;
      case 'AssuranceActivityType':
        result = await importAssuranceActivityType(rows);
        break;
      case 'ControlAssignment':
        result = await importControlAssignments(rows);
        break;
      default:
        return NextResponse.json(
          { error: `Table ${table} import not yet implemented` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing CSV:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
