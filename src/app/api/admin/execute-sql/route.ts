import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const { sql } = await request.json();

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
    }

    const sqlTrimmed = sql.trim();

    // Safety check: prevent dangerous operations
    const dangerousPatterns = [
      /DROP\s+DATABASE/i,
      /DELETE\s+FROM\s+information_schema/i,
      /PRAGMA\s+database_list/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sqlTrimmed)) {
        return NextResponse.json(
          { error: "This SQL operation is not allowed" },
          { status: 400 }
        );
      }
    }

    // Execute the query
    const result = await (prisma as any).$queryRawUnsafe(sqlTrimmed);

    // Format results for display
    let formattedResult = result;
    if (Array.isArray(result)) {
      formattedResult = {
        rowsAffected: result.length,
        rows: result,
        isSelect: true,
      };
    } else if (typeof result === "number") {
      formattedResult = {
        rowsAffected: result,
        isModify: true,
      };
    }

    return NextResponse.json({
      success: true,
      result: formattedResult,
      message: `Query executed successfully. ${
        Array.isArray(result)
          ? `${result.length} rows returned.`
          : `${result} rows affected.`
      }`,
    });
  } catch (error: any) {
    console.error("SQL Execution Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute SQL query",
        details: error.message,
      },
      { status: 400 }
    );
  }
}
