import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Critical tables that should exist
    const criticalTables = [
      "User",
      "ProcessArea",
      "SubProcess",
      "Control",
      "Assessment",
      "AssessmentControl",
      "Sample",
    ];

    // Get list of actual tables in database
    const existingTables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );

    const existingTableNames = new Set(existingTables.map((t) => t.name));
    const missingTables = criticalTables.filter((t) => !existingTableNames.has(t));

    if (missingTables.length > 0) {
      return NextResponse.json({
        synced: false,
        needsMigration: true,
        message: `❌ Missing tables: ${missingTables.join(", ")}. Run: npx prisma migrate dev`,
        missingTables,
        existingTables: existingTables.map((t) => t.name).sort(),
      });
    }

    // Check AssessmentControl table specifically (new in v1.7.0)
    if (!existingTableNames.has("AssessmentControl")) {
      return NextResponse.json({
        synced: false,
        needsMigration: true,
        message:
          "❌ AssessmentControl table missing (decoupling migration not applied). Run: npx prisma migrate dev",
        missingTables: ["AssessmentControl"],
        existingTables: existingTables.map((t) => t.name).sort(),
      });
    }

    // All critical tables exist
    return NextResponse.json({
      synced: true,
      needsMigration: false,
      message: `✅ Database is synced! Found ${existingTables.length} tables including all critical ones.`,
      existingTables: existingTables.map((t) => t.name).sort(),
    });
  } catch (error) {
    console.error("Error checking database sync:", error);
    return NextResponse.json(
      {
        synced: false,
        needsMigration: true,
        message: `Error checking sync: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
