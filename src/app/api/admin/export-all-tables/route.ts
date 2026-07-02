import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // List of all tables to export (from Prisma schema)
    const tables = [
      "User",
      "ProcessArea",
      "SubProcess",
      "Control",
      "Assessment",
      "Sample",
      "AssuranceActivityType",
      "SampleType",
      "RecordSourceType",
      "AssessmentTemplate",
      "AssessmentTemplateControlLinkage",
      "AssessmentTemplateActivityType",
      "AchievementBadge",
      "UserAchievement",
      "PointTransaction",
      "BehaviorMeasurement",
      "EmotionalDriveMetric",
      "Milestone",
    ];

    const allTablesData: Record<string, any[]> = {};
    const exportSummary: Record<string, number> = {};

    // Export each table
    for (const tableName of tables) {
      try {
        const model = (prisma as any)[tableName.charAt(0).toLowerCase() + tableName.slice(1)];
        if (model && typeof model.findMany === "function") {
          const data = await model.findMany();
          allTablesData[tableName] = data;
          exportSummary[tableName] = data.length;
        }
      } catch (err) {
        console.warn(`Could not export table ${tableName}:`, err);
        allTablesData[tableName] = [];
        exportSummary[tableName] = 0;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      exportSummary,
      tables: allTablesData,
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export tables" },
      { status: 500 }
    );
  }
}
