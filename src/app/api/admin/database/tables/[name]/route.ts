import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { name } = await params;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Table name is required" },
        { status: 400 }
      );
    }

    // Validate table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { error: "Invalid table name" },
        { status: 400 }
      );
    }

    // Prevent dropping system tables
    const systemTables = [
      "User",
      "ProcessArea",
      "SubProcess",
      "Control",
      "Assessment",
      "ControlAssignment",
      "Sample",
      "AssuranceActivityType",
      "AssessmentTemplate",
      "AssessmentTemplateControlLinkage",
      "AssessmentTemplateActivityType",
      "SampleType",
      "RecordSourceType",
      "AchievementBadge",
      "UserAchievement",
      "PointTransaction",
      "BehaviorMeasurement",
      "EmotionalDriveMetric",
      "Milestone",
    ];

    if (systemTables.includes(name)) {
      return NextResponse.json(
        { error: `Cannot drop system table '${name}'` },
        { status: 403 }
      );
    }

    // Check if table exists
    const existing = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name = '${name}'`
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: `Table '${name}' not found` },
        { status: 404 }
      );
    }

    // Drop the table
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${name}"`);

    // Run VACUUM to reclaim space
    await prisma.$executeRawUnsafe(`VACUUM`);

    return NextResponse.json({
      success: true,
      message: `Table '${name}' dropped successfully`,
    });
  } catch (error) {
    console.error("Error dropping table:", error);
    return NextResponse.json(
      { error: "Failed to drop table" },
      { status: 500 }
    );
  }
}
