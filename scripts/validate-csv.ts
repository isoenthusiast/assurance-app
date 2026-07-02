import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

const REQUIRED_FIELDS = ['name', 'statement', 'controlType', 'processAreaId', 'subProcessId'];
const VALID_CONTROL_TYPES = ['Engineering', 'Procedural', 'Behavioural', 'Administrative', 'Physical', 'Detective'];

async function validateCSV(filePath: string): Promise<ValidationResult> {
  console.log(`📋 Validating CSV: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Fetch all valid IDs from database
  const processAreas = await prisma.processArea.findMany();
  const subProcesses = await prisma.subProcess.findMany();

  const validProcessAreaIds = new Set(processAreas.map(pa => pa.id));
  const validSubProcessIds = new Set(subProcesses.map(sp => sp.id));

  const result: ValidationResult = {
    totalRows: records.length,
    validRows: 0,
    invalidRows: 0,
    errors: [],
    warnings: [],
  };

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
        column: 'controlType',
        value: controlType,
        reason: `Invalid control type. Must be one of: ${VALID_CONTROL_TYPES.join(', ')}`,
      });
    }

    // Validate processAreaId exists
    const processAreaId = record.processAreaId?.trim();
    if (processAreaId && !validProcessAreaIds.has(processAreaId)) {
      rowErrors.push({
        row: rowNum,
        column: 'processAreaId',
        value: processAreaId,
        reason: `ProcessArea ID not found in database`,
      });
    }

    // Validate subProcessId exists
    const subProcessId = record.subProcessId?.trim();
    if (subProcessId && !validSubProcessIds.has(subProcessId)) {
      rowErrors.push({
        row: rowNum,
        column: 'subProcessId',
        value: subProcessId,
        reason: `SubProcess ID not found in database`,
      });
    }

    // Check for suspiciously long text fields
    const textFields = ['name', 'statement', 'csfWho', 'csfWhat', 'csfWhen', 'csfWhere', 'csfWhy', 'csfHow', 'csfEvidence'];
    textFields.forEach((field) => {
      const value = record[field];
      if (value && value.length > 5000) {
        rowWarnings.push({
          row: rowNum,
          column: field,
          value: `${value.substring(0, 50)}...`,
          reason: `Text field is very long (${value.length} chars) - may cause issues`,
        });
      }
    });

    // Check numeric fields
    const numericFields = ['riskWeight', 'rawHealthScore'];
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

    // Check boolean fields
    const booleanFields = ['isHsseCritical'];
    booleanFields.forEach((field) => {
      const value = record[field];
      if (value && !['true', 'false', 'TRUE', 'FALSE', '1', '0', 'yes', 'no', 'Yes', 'No'].includes(value)) {
        rowWarnings.push({
          row: rowNum,
          column: field,
          value,
          reason: `Should be true/false (found: ${value})`,
        });
      }
    });

    // Check date fields
    const dateFields = ['lastTestedDate'];
    dateFields.forEach((field) => {
      const value = record[field];
      if (value && isNaN(Date.parse(value))) {
        rowErrors.push({
          row: rowNum,
          column: field,
          value,
          reason: `Invalid date format. Use ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)`,
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

  return result;
}

async function main() {
  try {
    const csvPath = process.argv[2];
    if (!csvPath) {
      console.error('❌ Usage: npx ts-node scripts/validate-csv.ts <path-to-csv>');
      console.error('Example: npx ts-node scripts/validate-csv.ts Control_template.csv');
      process.exit(1);
    }

    const result = await validateCSV(csvPath);

    // Print summary
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log(`Total rows:     ${result.totalRows}`);
    console.log(`Valid rows:     ${result.validRows} ✓`);
    console.log(`Invalid rows:   ${result.invalidRows} ✗`);
    console.log(`Warnings:       ${result.warnings.length} ⚠️\n`);

    // Print errors
    if (result.errors.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('❌ ERRORS (will prevent import)');
      console.log('═══════════════════════════════════════════════════════════════════\n');

      // Group errors by row
      const errorsByRow = new Map<number, ValidationError[]>();
      result.errors.forEach((err) => {
        if (!errorsByRow.has(err.row)) {
          errorsByRow.set(err.row, []);
        }
        errorsByRow.get(err.row)!.push(err);
      });

      // Sort by row number
      const sortedRows = Array.from(errorsByRow.keys()).sort((a, b) => a - b);
      sortedRows.forEach((rowNum) => {
        const errs = errorsByRow.get(rowNum)!;
        console.log(`Row ${rowNum}:`);
        errs.forEach((err) => {
          console.log(`  • ${err.column}: ${err.reason}`);
          console.log(`    Value: ${JSON.stringify(err.value)}`);
        });
        console.log();
      });
    }

    // Print warnings
    if (result.warnings.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('⚠️  WARNINGS (may not prevent import but should be reviewed)');
      console.log('═══════════════════════════════════════════════════════════════════\n');

      const warningsByRow = new Map<number, ValidationWarning[]>();
      result.warnings.forEach((warn) => {
        if (!warningsByRow.has(warn.row)) {
          warningsByRow.set(warn.row, []);
        }
        warningsByRow.get(warn.row)!.push(warn);
      });

      const sortedRows = Array.from(warningsByRow.keys()).sort((a, b) => a - b).slice(0, 20); // Show first 20
      sortedRows.forEach((rowNum) => {
        const warns = warningsByRow.get(rowNum)!;
        console.log(`Row ${rowNum}:`);
        warns.forEach((warn) => {
          console.log(`  • ${warn.column}: ${warn.reason}`);
          console.log(`    Value: ${JSON.stringify(warn.value)}`);
        });
        console.log();
      });

      if (result.warnings.length > 20) {
        console.log(`... and ${result.warnings.length - 20} more warnings\n`);
      }
    }

    // Final recommendation
    console.log('═══════════════════════════════════════════════════════════════════');
    if (result.invalidRows === 0) {
      console.log('✅ CSV is ready to import!');
    } else {
      console.log(`❌ CSV has ${result.invalidRows} rows with errors.`);
      console.log('Fix these errors before attempting import.');
    }
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
