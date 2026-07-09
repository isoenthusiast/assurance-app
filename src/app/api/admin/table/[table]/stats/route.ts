import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const TABLE_SCHEMAS: Record<string, string[]> = {
  User: ['id', 'name', 'username', 'role', 'totalPoints', 'dailyPointStreak', 'confidenceInfluencer', 'createdAt'],
  ProcessArea: ['id', 'name', 'description', 'createdAt'],
  SubProcess: ['id', 'name', 'description', 'processAreaId', 'createdAt'],
  Control: ['id', 'name', 'statement', 'controlType', 'processAreaId', 'isHsseCritical', 'ramRating', 'riskWeight', 'rawHealthScore', 'createdAt'],
  Assessment: ['id', 'activityTypeId', 'name', 'assessorId', 'startDate', 'endDate', 'loa', 'status', 'createdAt'],
  Sample: ['id', 'assessmentId', 'controlId', 'comment', 'status', 'conclusion', 'evidenceUrl', 'createdAt'],
  AssuranceActivityType: ['id', 'name', 'description', 'defaultLOA', 'createdAt'],
  AchievementBadge: ['id', 'name', 'description', 'icon', 'emotionalDrive', 'rarity', 'pointsRequired', 'controlsChecked', 'streakDays', 'achievementType', 'createdAt'],
  BehaviorMeasurement: ['id', 'userId', 'date', 'plansMade', 'controlsTested', 'evidenceDocumented', 'teamEngagement', 'qualityScore', 'createdAt'],
  PointTransaction: ['id', 'userId', 'points', 'reason', 'assessmentId', 'sampleId', 'emotionalDrive', 'multiplier', 'createdAt'],
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { table } = await params;
    const columns = TABLE_SCHEMAS[table];

    if (!columns) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    let rowCount = 0;

    switch (table) {
      case 'User':
        rowCount = await prisma.user.count();
        break;
      case 'ProcessArea':
        rowCount = await prisma.processArea.count();
        break;
      case 'SubProcess':
        rowCount = await prisma.subProcess.count();
        break;
      case 'Control':
        rowCount = await prisma.control.count();
        break;
      case 'Assessment':
        rowCount = await prisma.assessment.count();
        break;
      case 'Sample':
        rowCount = await prisma.sample.count();
        break;
      case 'AssuranceActivityType':
        rowCount = await prisma.assuranceActivityType.count();
        break;
    }

    return NextResponse.json({
      table,
      rowCount,
      columnCount: columns.length,
    });
  } catch (error) {
    console.error('Error getting table stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
