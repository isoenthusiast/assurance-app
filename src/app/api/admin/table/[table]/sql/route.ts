import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";

/** Map Prisma scalar types to PostgreSQL types */
function prismaTypeToSQL(type: string, isRequired: boolean): string {
  const nullMarker = isRequired ? " NOT NULL" : "";
  switch (type) {
    case "String": return `TEXT${nullMarker}`;
    case "Int": return `INTEGER${nullMarker}`;
    case "Float": return `DOUBLE PRECISION${nullMarker}`;
    case "Boolean": return `BOOLEAN${nullMarker}`;
    case "DateTime": return `TIMESTAMPTZ${nullMarker}`;
    case "Decimal": return `DECIMAL(65,30)${nullMarker}`;
    case "BigInt": return `BIGINT${nullMarker}`;
    case "Bytes": return `BYTEA${nullMarker}`;
    case "JSON": return `JSONB${nullMarker}`;
    default: return `TEXT${nullMarker}`;
  }
}

/** Escape a value for SQL INSERT */
function escapeSQL(value: any): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  // String: escape single quotes and wrap
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

/** Convert JS value to SQL-compatible string for INSERT */
function formatSQLValue(value: any, type: string): string {
  if (value === null || value === undefined) return "NULL";
  switch (type) {
    case "Boolean":
      return value ? "TRUE" : "FALSE";
    case "Int":
    case "Float":
    case "Decimal":
    case "BigInt":
      return String(Number(value));
    case "DateTime": {
      // Handle ISO date strings, Date objects, or timestamps
      const d = new Date(value);
      if (isNaN(d.getTime())) return escapeSQL(String(value));
      return `'${d.toISOString()}'`;
    }
    default:
      return escapeSQL(value);
  }
}

export async function GET(
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

    // Get column info
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

    // Fetch all rows
    let rows: any[] = [];
    const camelName = table.charAt(0).toLowerCase() + table.slice(1);
    const model = (prisma as any)[camelName];

    if (model) {
      rows = await model.findMany();
    } else {
      const rawRows = await (prisma as any).$queryRawUnsafe(`SELECT * FROM "${table}"`);
      rows = Array.isArray(rawRows) ? rawRows : [];
    }

    // Build SQL
    const lines: string[] = [];
    lines.push(`-- SQL Export: ${table}`);
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Rows: ${rows.length}`);
    lines.push("");

    // CREATE TABLE IF NOT EXISTS
    lines.push(`CREATE TABLE IF NOT EXISTS "${table}" (`);
    const colDefs = cols.map((c) => {
      const sqlType = prismaTypeToSQL(c.type, c.required);
      let def = `  "${c.name}" ${sqlType}`;
      if (c.isId) def += " PRIMARY KEY";
      return def;
    });
    // Identify unique indexes from schema
    if (tableSchema) {
      const dmmf = (prisma as any)._dmmf;
      if (dmmf?.datamodel?.models) {
        const modelDef = dmmf.datamodel.models.find((m: any) => m.name === table);
        if (modelDef) {
          // Add unique constraints as comments
          const uniqueFields = modelDef.uniqueFields || [];
          if (uniqueFields.length > 0) {
            uniqueFields.forEach((uf: string[]) => {
              if (uf.length === 1 && cols.some(c => c.name === uf[0] && c.isId)) return; // skip PK
              lines.push(`  -- UNIQUE(${uf.map((f: string) => `"${f}"`).join(", ")})`);
            });
          }
        }
      }
    }
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");

    // INSERT statements (batch of 100 rows per INSERT for performance)
    const colNames = cols.map((c) => `"${c.name}"`);
    const colTypeMap = new Map(cols.map((c) => [c.name, c.type]));

    if (rows.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const valuesList = batch.map((row) => {
          const vals = colNames.map((cn) => {
            const cleanName = cn.replace(/"/g, "");
            const val = row[cleanName];
            const type = colTypeMap.get(cleanName) || "String";
            return formatSQLValue(val, type);
          });
          return `(${vals.join(", ")})`;
        });
        lines.push(`INSERT INTO "${table}" (${colNames.join(", ")}) VALUES`);
        lines.push(valuesList.join(",\n") + ";");
        lines.push("");
      }
    } else {
      lines.push(`-- No rows to export`);
    }

    const sql = lines.join("\n");

    return new Response(sql, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}_export.sql"`,
      },
    });
  } catch (error) {
    console.error("Error exporting SQL:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
