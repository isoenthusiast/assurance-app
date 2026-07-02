import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getAllTableNames } from "@/lib/schema-introspection";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check admin status
    const isAdmin = session.user.role === "Admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    // Get available tables dynamically from Prisma DMMF
    try {
      const tables = getAllTableNames();

      if (!tables || tables.length === 0) {
        console.warn('No tables returned from getAllTableNames');
        return NextResponse.json({
          tables: [
            'User',
            'ProcessArea',
            'SubProcess',
            'Control',
            'Assessment',
            'Sample',
            'AssuranceActivityType',
            'AchievementBadge',
            'BehaviorMeasurement',
            'PointTransaction',
            'UserAchievement',
            'EmotionalDriveMetric',
            'Milestone',
          ],
          warning: 'Using fallback table list',
        });
      }

      return NextResponse.json({
        tables,
      });
    } catch (schemaError) {
      console.error('Error getting tables from schema:', schemaError);
      // Return fallback list if schema introspection fails
      return NextResponse.json({
        tables: [
          'User',
          'ProcessArea',
          'SubProcess',
          'Control',
          'Assessment',
          'ControlAssignment',
          'Sample',
          'AssuranceActivityType',
          'AchievementBadge',
          'BehaviorMeasurement',
          'PointTransaction',
          'UserAchievement',
          'EmotionalDriveMetric',
          'Milestone',
        ],
        warning: 'Using fallback table list due to schema introspection error',
      });
    }
  } catch (error) {
    console.error('Error in tables route:', error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
