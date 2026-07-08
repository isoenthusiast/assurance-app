import { NextRequest, NextResponse } from 'next/server';
import {
  awardPoints,
  awardBadge,
  calculatePointsFromRules,
} from '@/lib/gamification';

/**
 * Award points and update metrics for a control test.
 *
 * Uses GameAttributeRule lookup to determine points based on activity type.
 * Links each PointTransaction to an ActivityLog entry for full audit trail.
 *
 * Body:
 *   userId, action (activityType string, e.g. "Complete Assessment"),
 *   controlCount?, isHSSECritical?, qualityScore?,
 *   assessmentId?, sampleId?, activityLogId?
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      action,           // activityType string — must match GameAttributeRule.activityType
      controlCount,
      isHSSECritical,
      qualityScore,
      assessmentId,
      sampleId,
      activityLogId,    // optional — links PointTransaction ← ActivityLog
    } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      );
    }

    // ── Look up rules for this activity type ──
    const ruleResults = await calculatePointsFromRules(action, {
      controlCount: controlCount || 0,
      isHsseCritical: !!isHSSECritical,
      qualityScore,
    });

    if (ruleResults.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No active rules found for activity type "${action}"`,
        pointsAwarded: 0,
      });
    }

    // ── Award points for each matching rule ──
    let totalAwarded = 0;
    for (const rule of ruleResults) {
      await awardPoints(
        userId,
        rule.points,
        action,
        undefined,        // emotionalDrive (mapped by rule system now)
        assessmentId,
        sampleId,
        1.0,              // multiplier already applied in calculatePointsFromRules
        rule.gameAttributeId,
        activityLogId,
      );
      totalAwarded += rule.points;
    }

    // Check for badge achievements
    const badges = await checkBadgeAchievements(userId, action);
    for (const badge of badges) {
      await awardBadge(userId, badge);
    }

    return NextResponse.json({
      success: true,
      pointsAwarded: totalAwarded,
      breakdown: ruleResults.map(r => ({
        attribute: r.gameAttributeName,
        points: r.points,
        ruleId: r.ruleId,
      })),
      badgesEarned: badges,
    });
  } catch (error) {
    console.error('Error awarding points:', error);
    return NextResponse.json(
      { error: 'Failed to award points' },
      { status: 500 }
    );
  }
}

/**
 * Check if user qualifies for any badges based on recent activity
 */
async function checkBadgeAchievements(userId: string, action: string): Promise<string[]> {
  const badges: string[] = [];

  if (action === 'control_tested') {
    badges.push('First Test');
  }

  if (action === 'fla_planned') {
    badges.push('Starter');
  }

  // Add more badge checks as needed
  // This would involve querying the database to check achievement criteria

  return badges;
}
