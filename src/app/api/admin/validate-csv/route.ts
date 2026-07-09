import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ValidationError {
  row: number;
  column: string;
  value: any;
  reason: string;
}

interface ValidationWarning {
  row: number;
  column: string;
  value: any;
  reason: string;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  canImport: boolean;
}

const REQUIRED_FIELDS = ["name", "statement", "controlType", "processAreaId"];
const VALID_CONTROL_TYPES = [
  "Administrative",
  "Procedural",
  "Analytical",
  "Behavioral",
  "Informational",
  "Engineering",
];

/**
 * Simple CSV parser - handles quoted fields and line breaks within quotes
 */
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const header = parseCSVLine(lines[0]);
  if (!header || header.length === 0) return [];

  // Parse data rows
  const records: Record<string, string>[] = [];
  let currentLine = '';

  for (let i = 1; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    // Skip completely empty lines
    if (!trimmedLine && !currentLine) {
      continue;
    }

    currentLine += (currentLine ? '\n' : '') + lines[i];

    // Check if line is complete (even number of unescaped quotes)
    if ((currentLine.match(/"/g) || []).length % 2 === 0) {
      const values = parseCSVLine(currentLine);
      if (values && values.length > 0) {
        const record: Record<string, string> = {};
        header.forEach((key, idx) => {
          record[key] = values[idx] || '';
        });
        records.push(record);
      }
      currentLine = '';
    }
  }

  return records;
}

/**
 * Parse a single CSV line, respecting quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
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
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if ((session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const table = formData.get("table") as string;

    if (!file || !table) {
      return NextResponse.json({ error: "Missing file or table" }, { status: 400 });
    }

    // Validation is only implemented for these tables for now
    if (table !== "Control" && table !== "ControlAssignment") {
      return NextResponse.json({ error: "Validation only supported for Control and ControlAssignment tables" }, { status: 400 });
    }

    const fileContent = await file.text();
    let records = parseCSV(fileContent);

    // Filter out completely empty rows
    records = records.filter((record) => {
      return Object.values(record).some((value) => value && value.trim().length > 0);
    });

    const result: ValidationResult = {
      totalRows: records.length,
      validRows: 0,
      invalidRows: 0,
      errors: [],
      warnings: [],
      canImport: true,
    };

    if (table === "ControlAssignment") {
      const assessments = await prisma.assessment.findMany({ select: { id: true } });
      const controls = await prisma.control.findMany({ select: { id: true } });
      const validAssessmentIds = new Set(assessments.map((a) => a.id));
      const validControlIds = new Set(controls.map((c) => c.id));
      const seenPairs = new Set<string>();

      records.forEach((record: any, index: number) => {
        const rowNum = index + 2;
        const rowErrors: ValidationError[] = [];

        const assessmentId = record.assessmentId?.trim();
        const controlId = record.controlId?.trim();

        if (!assessmentId) {
          rowErrors.push({
            row: rowNum,
            column: "assessmentId",
            value: record.assessmentId,
            reason: "Required field is empty",
          });
        } else if (!validAssessmentIds.has(assessmentId)) {
          rowErrors.push({
            row: rowNum,
            column: "assessmentId",
            value: assessmentId,
            reason: "Assessment ID not found in database",
          });
        }

        if (!controlId) {
          rowErrors.push({
            row: rowNum,
            column: "controlId",
            value: record.controlId,
            reason: "Required field is empty",
          });
        } else if (!validControlIds.has(controlId)) {
          rowErrors.push({
            row: rowNum,
            column: "controlId",
            value: controlId,
            reason: "Control ID not found in database",
          });
        }

        if (assessmentId && controlId) {
          const pairKey = `${assessmentId}::${controlId}`;
          if (seenPairs.has(pairKey)) {
            rowErrors.push({
              row: rowNum,
              column: "controlId",
              value: controlId,
              reason: "Duplicate assessmentId/controlId pair within this CSV",
            });
          }
          seenPairs.add(pairKey);
        }

        if (rowErrors.length > 0) {
          result.invalidRows++;
          result.errors.push(...rowErrors);
        } else {
          result.validRows++;
        }
      });

      result.canImport = result.invalidRows === 0;
      return NextResponse.json(result);
    }

    // Fetch all valid IDs from database
    const processAreas = await prisma.processArea.findMany();
    const subProcesses = await prisma.subProcess.findMany();

    const validProcessAreaIds = new Set(processAreas.map((pa) => pa.id));
    const validSubProcessIds = new Set(subProcesses.map((sp) => sp.id));

    records.forEach((record: any, index: number) => {
      const rowNum = index + 2; // +1 for header, +1 for 1-indexed
      const rowErrors: ValidationError[] = [];
      const rowWarnings: ValidationWarning[] = [];

      // Check required fields
      REQUIRED_FIELDS.forEach((field) => {
        const value = record[field]?.trim();
        if (!value) {
          rowErrors.push({
            row: rowNum,
            column: field,
            value: record[field],
            reason: `Required field is empty`,
          });
        }
      });

      // Validate controlType
      const controlType = record.controlType?.trim();
      if (controlType && !VALID_CONTROL_TYPES.includes(controlType)) {
        rowErrors.push({
          row: rowNum,
          column: "controlType",
          value: controlType,
          reason: `Invalid control type. Must be one of: ${VALID_CONTROL_TYPES.join(", ")}`,
        });
      }

      // Validate processAreaId exists
      const processAreaId = record.processAreaId?.trim();
      if (processAreaId && !validProcessAreaIds.has(processAreaId)) {
        rowErrors.push({
          row: rowNum,
          column: "processAreaId",
          value: processAreaId,
          reason: `ProcessArea ID not found in database`,
        });
      }

      // Validate subProcessId exists
      const subProcessId = record.subProcessId?.trim();
      if (subProcessId && !validSubProcessIds.has(subProcessId)) {
        rowErrors.push({
          row: rowNum,
          column: "subProcessId",
          value: subProcessId,
          reason: `SubProcess ID not found in database`,
        });
      }

      // Check for suspiciously long text fields
      const textFields = [
        "name",
        "statement",
        "csfWho",
        "csfWhat",
        "csfWhen",
        "csfWhere",
        "csfWhy",
        "csfHow",
        "csfEvidence",
      ];
      textFields.forEach((field) => {
        const value = record[field];
        if (value && value.length > 5000) {
          rowWarnings.push({
            row: rowNum,
            column: field,
            value: `${value.substring(0, 50)}...`,
            reason: `Text field is very long (${value.length} chars)`,
          });
        }
      });

      // Check numeric fields
      const numericFields = ["riskWeight", "rawHealthScore"];
      numericFields.forEach((field) => {
        const value = record[field];
        if (value && isNaN(Number(value))) {
          rowErrors.push({
            row: rowNum,
            column: field,
            value,
            reason: `Must be a number`,
          });
        }
      });

      // Check date fields
      const dateFields = ["lastTestedDate"];
      dateFields.forEach((field) => {
        const value = record[field];
        if (value && isNaN(Date.parse(value))) {
          rowErrors.push({
            row: rowNum,
            column: field,
            value,
            reason: `Invalid date format. Use ISO 8601 (YYYY-MM-DD)`,
          });
        }
      });

      // Aggregate results
      if (rowErrors.length > 0) {
        result.invalidRows++;
        result.errors.push(...rowErrors);
      } else if (rowWarnings.length > 0) {
        result.validRows++;
        result.warnings.push(...rowWarnings);
      } else {
        result.validRows++;
      }
    });

    result.canImport = result.invalidRows === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error validating CSV:", error);
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
