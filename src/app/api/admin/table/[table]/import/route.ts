import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";

/** Parse CSV content into an array of objects */
function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = idx < values.length ? values[idx] : "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse a single CSV line, handling quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/** Convert CSV string value to the correct JS type based on column type */
function coerceValue(value: string, type: string): any {
  if (value === "" || value === "NULL" || value === "null") return null;
  switch (type) {
    case "Boolean":
      return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
    case "Int":
      return parseInt(value, 10);
    case "Float":
    case "Decimal":
      return parseFloat(value);
    case "BigInt":
      return BigInt(value);
    case "DateTime":
      // Try to parse as ISO date
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString();
    default:
      return value;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { table } = await params;

    // Get column type info
    interface ColInfo { name: string; type: string; required: boolean; isId: boolean }
    let cols: ColInfo[] = [];

    const tableSchema = getTableSchema(table);
    if (tableSchema) {
      cols = tableSchema.columns
        .filter((col) => col.kind !== "object")
        .map((col) => ({ name: col.name, type: col.type, required: col.required, isId: col.isId }));
    } else {
      const fallback = getFallbackSchema(table);
      if (fallback) {
        cols = Object.entries(fallback).map(([name, config]) => ({
          name, type: config.type, required: config.required, isId: config.isId,
        }));
      }
    }

    if (cols.length === 0) {
      return NextResponse.json({ error: "Table not found or no columns" }, { status: 404 });
    }

    // Read CSV file from multipart form data
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No CSV file provided. Use form field 'file'." }, { status: 400 });
    }

    const csvText = await file.text();
    const { headers, rows } = parseCSV(csvText);

    if (headers.length === 0) {
      return NextResponse.json({ error: "CSV file is empty or has no header row" }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file has no data rows" }, { status: 400 });
    }

    // Validate headers against table columns
    const colNameSet = new Set(cols.map((c) => c.name.toLowerCase()));
    const unknownHeaders = headers.filter((h) => !colNameSet.has(h.toLowerCase()));
    if (unknownHeaders.length > 0) {
      return NextResponse.json({
        error: `Unknown columns in CSV: ${unknownHeaders.join(", ")}. Valid columns: ${cols.map(c => c.name).join(", ")}`,
      }, { status: 400 });
    }

    // Build type map for matched columns
    const colTypeMap = new Map(cols.map((c) => [c.name.toLowerCase(), c.type]));

    // Build INSERT statements and execute
    const camelName = table.charAt(0).toLowerCase() + table.slice(1);
    const model = (prisma as any)[camelName];

    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const csvRow = rows[i];
      const data: Record<string, any> = {};

      // Map CSV values to correct types
      for (const [key, value] of Object.entries(csvRow)) {
        const colType = colTypeMap.get(key.toLowerCase()) || "String";
        // Find exact column name (case-insensitive)
        const exactCol = cols.find((c) => c.name.toLowerCase() === key.toLowerCase());
        if (exactCol) {
          data[exactCol.name] = coerceValue(value, colType);
        }
      }

      // Auto-generate id if missing and it's a String id column
      const pkCol = cols.find((c) => c.isId);
      if (pkCol && !data[pkCol.name]) {
        if (pkCol.type === "String") {
          data[pkCol.name] = `id_${Date.now()}_${i}`;
        }
        // For Int PKs, let the DB auto-increment
      }

      try {
        if (model) {
          await model.create({ data });
        } else {
          // Raw SQL INSERT
          const keys = Object.keys(data);
          const vals = keys.map((k) => {
            const v = data[k];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
            if (typeof v === "number") return String(v);
            if (typeof v === "bigint") return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          await (prisma as any).$executeRawUnsafe(
            `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${vals.join(", ")})`
          );
        }
        inserted++;
      } catch (e: any) {
        errors.push(`Row ${i + 2}: ${e.message}`);
        // Stop on first error to avoid cascading issues
        if (errors.length >= 10) break;
      }
    }

    const result: any = {
      ok: true,
      table,
      inserted,
      total: rows.length,
    };
    if (errors.length > 0) {
      result.errors = errors;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error importing CSV:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
