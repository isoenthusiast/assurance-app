import { NextResponse } from "next/server";
import { getTableSchema } from "@/lib/schema-introspection";
import { getFallbackSchema } from "@/lib/fallback-schemas";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { response } = await requireAdmin();
    if (response) return response;

    const { table } = await params;

    // Get schema for table
    const tableSchema = getTableSchema(table);
    let columns: string[] = [];

    if (tableSchema) {
      columns = tableSchema.columns
        .filter((col) => col.kind !== "object")
        .map((col) => col.name);
    } else {
      // Fall back to JSON schema
      const fallbackSchema = await getFallbackSchema(table);
      if (fallbackSchema) {
        columns = Object.keys(fallbackSchema);
      }
    }

    if (columns.length === 0) {
      return NextResponse.json(
        { error: `Table '${table}' not found` },
        { status: 404 }
      );
    }

    // For Control table, include sample ProcessArea and SubProcess IDs
    let sampleRow: (string | number)[] = [];
    let example: (string | number | boolean)[][] = [];

    if (table === "Control") {
      // Get first ProcessArea and SubProcess for sample values
      const processArea = await prisma.processArea.findFirst();
      const subProcess = await prisma.subProcess.findFirst();

      const paId = processArea?.id || "paste-processarea-id-here";
      const spId = subProcess?.id || "paste-subprocess-id-here";

      sampleRow = columns.map((col) => {
        if (col === "processAreaId") return paId;
        if (col === "subProcessId") return spId;
        if (col === "name") return "Example Control Name";
        if (col === "statement") return "Example control statement";
        if (col === "controlType") return "Administrative";
        if (col === "isHsseCritical") return "false";
        if (col === "riskWeight") return 1;
        if (col === "rawHealthScore") return 80;
        return "";
      });

      example = [sampleRow];
    } else {
      // Generic sample row
      sampleRow = columns.map((col) => {
        if (col === "id") return "auto-generated";
        if (col.includes("Id")) return "copy-from-reference-table";
        if (col === "createdAt" || col === "updatedAt")
          return "auto-generated";
        if (col === "name") return "Example Name";
        if (col === "description") return "Example description";
        if (col === "status") return "Active";
        return "";
      });

      example = [sampleRow];
    }

    return NextResponse.json({
      table,
      columns,
      sampleRow,
      example,
    });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}
