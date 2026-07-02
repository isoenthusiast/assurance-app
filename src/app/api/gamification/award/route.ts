import { NextRequest, NextResponse } from 'next/server';
import {
  awardPoints,
  awardBadge,
  recordDailyBehavior,
  POINT_RULES,
} from '@/lib/gamification';

/**
 * Award points and update metrics for a control test
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      action,
      controlId,
      assessmentId,
      isHSSECritical,
      qualityScore,
      sampleId,
    } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'userId and action are required' },
        { status: 400 }
      );
    }

    let points = 0;
    let emotionalDrive = null;
    let multiplier = 1.0;

    // Determine points based on action
    switch (action) {
      case 'control_tested':
        points = POINT_RULES.CONTROL_TESTED;
        emotionalDrive = 'Achievement';
        if (isHSSECritical) {
          points += POINT_RULES.CONTROL_TESTED_HSSE;
          emotionalDrive = 'Security';
        }
        if (qualityScore && qualityScore > 80) {
          multiplier = 1.5;
        }

        // Record behavior
        await recordDailyBehavior(userId, new Date(), {
          controlsTested: 1,
          qualityScore: qualityScore || 0,
        });

        break;

      case 'fla_planned':
        points = POINT_RULES.FLA_PLANNED;
        emotionalDrive = 'Achievement';
        await recordDailyBehavior(userId, new Date(), { plansMade: 1 });
        break;

      case 'evidence_documented':
        points = POINT_RULES.EVIDENCE_DOCUMENTED;
        emotionalDrive = 'Contribution';
        if (qualityScore && qualityScore > 80) {
          points = POINT_RULES.EVIDENCE_DOCUMENTED_QUALITY;
          emotionalDrive = 'Excellence';
        }
        await recordDailyBehavior(userId, new Date(), {
          evidenceDocumented: 1,
        });
        break;

      case 'assessment_completed':
        points = POINT_RULES.ASSESSMENT_COMPLETED;
        emotionalDrive = 'Achievement';
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Award points
    await awardPoints(
      userId,
      points,
      action,
      emotionalDrive as any,
      assessmentId,
      sampleId,
      multiplier
    );

    // Check for badge achievements
    const badges = await checkBadgeAchievements(userId, action);
    for (const badge of badges) {
      await awardBadge(userId, badge);
    }

    return NextResponse.json({
      success: true,
      pointsAwarded: Math.round(points * multiplier),
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
