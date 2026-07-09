import { prisma } from "./prisma";
import { EmotionalDrive, BadgeRarity } from "../generated/prisma/enums";

/**
 * Gamification Engine - Points, Achievements, Emotional Drives
 * Based on: 8 Emotional Drives + Measure Everything Framework
 */

// Badge Definitions tied to 8 Emotional Drives
export const BADGE_DEFINITIONS = [
  // DIVERSITY - Drive for new experiences
  {
    badgeName: "Explorer",
    description: "Test controls from 5 different Process Areas",
    emotionalDrive: "Diversity" as EmotionalDrive,
    rarity: "Uncommon" as BadgeRarity,
    achievementType: "diversity_explorer",
  },
  {
    badgeName: "Week of Change",
    description: "Complete 7 different daily behavior patterns in one week",
    emotionalDrive: "Diversity" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "weekly_diversity",
  },

  // BELONGING - Drive to be with people, community
  {
    badgeName: "Team Player",
    description: "Participate in 3 team FLA planning sessions",
    emotionalDrive: "Belonging" as EmotionalDrive,
    rarity: "Uncommon" as BadgeRarity,
    achievementType: "team_player",
  },
  {
    badgeName: "Community Champion",
    description: "Help 5 different team members complete their assessments",
    emotionalDrive: "Belonging" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "community_champion",
  },

  // RECOGNITION - Drive to feel valuable
  {
    badgeName: "First Test",
    description: "Complete your first control test",
    emotionalDrive: "Recognition" as EmotionalDrive,
    rarity: "Common" as BadgeRarity,
    achievementType: "first_test",
  },
  {
    badgeName: "Recognized Expert",
    description: "Earn 1000 points for test quality and consistency",
    emotionalDrive: "Recognition" as EmotionalDrive,
    rarity: "Epic" as BadgeRarity,
    pointsRequired: 1000,
    achievementType: "quality_leader",
  },

  // ACHIEVEMENT - Drive to complete things
  {
    badgeName: "Starter",
    description: "Plan your first FLA",
    emotionalDrive: "Achievement" as EmotionalDrive,
    rarity: "Common" as BadgeRarity,
    achievementType: "first_fla",
  },
  {
    badgeName: "Milestone Getter",
    description: "Complete 5 milestone achievements",
    emotionalDrive: "Achievement" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "milestone_master",
  },
  {
    badgeName: "Perfect Week",
    description: "Complete daily activities 7 days in a row",
    emotionalDrive: "Achievement" as EmotionalDrive,
    rarity: "Epic" as BadgeRarity,
    streakDays: 7,
    achievementType: "perfect_week",
  },

  // EXCELLENCE - Drive to do better than expected
  {
    badgeName: "Quality Obsessed",
    description: "Document evidence for 10 consecutive controls with >90% quality score",
    emotionalDrive: "Excellence" as EmotionalDrive,
    rarity: "Epic" as BadgeRarity,
    controlsChecked: 10,
    achievementType: "excellence_seeker",
  },
  {
    badgeName: "Perfect Assessor",
    description: "Complete assessment with 100% control pass rate",
    emotionalDrive: "Excellence" as EmotionalDrive,
    rarity: "Legendary" as BadgeRarity,
    achievementType: "perfect_assessment",
  },

  // GROWTH - Drive to improve yourself
  {
    badgeName: "Learner",
    description: "Test controls from 3 different Sub-Processes",
    emotionalDrive: "Growth" as EmotionalDrive,
    rarity: "Uncommon" as BadgeRarity,
    controlsChecked: 3,
    achievementType: "learner",
  },
  {
    badgeName: "Rising Star",
    description: "Improve your quality score by 20% month-over-month",
    emotionalDrive: "Growth" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "growth_trajectory",
  },

  // CONTRIBUTION - Drive for purpose beyond self
  {
    badgeName: "Mentor",
    description: "Document 5 control test guides for team reuse",
    emotionalDrive: "Contribution" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "mentor",
  },
  {
    badgeName: "Organization Builder",
    description: "Identify and document 3 HSSE-critical control improvements",
    emotionalDrive: "Contribution" as EmotionalDrive,
    rarity: "Epic" as BadgeRarity,
    achievementType: "org_builder",
  },

  // SECURITY - Drive for safety and control
  {
    badgeName: "Safety First",
    description: "Test all HSSE-critical controls in your assigned area",
    emotionalDrive: "Security" as EmotionalDrive,
    rarity: "Rare" as BadgeRarity,
    achievementType: "safety_focused",
  },
  {
    badgeName: "Compliance Champion",
    description: "Zero deficiencies in 3 consecutive assessments",
    emotionalDrive: "Security" as EmotionalDrive,
    rarity: "Legendary" as BadgeRarity,
    achievementType: "compliance_leader",
  },
];

// Point Awarding Logic
export const POINT_RULES = {
  // FLA Planning
  FLA_PLANNED: 50,
  FLA_PLANNED_TEAM: 75, // Bonus for team involvement

  // Control Testing
  CONTROL_TESTED: 100,
  CONTROL_TESTED_HSSE: 150, // Bonus for HSSE-critical
  CONTROL_TESTED_PERFECT: 50, // Bonus multiplier for evidence quality

  // Evidence Documentation
  EVIDENCE_DOCUMENTED: 30,
  EVIDENCE_DOCUMENTED_QUALITY: 50, // When quality score > 80%

  // Behaviors
  DAILY_ACTIVITY_BONUS: 25, // Doing work 5+ times per week
  TEAM_COLLABORATION: 40,
  ASSESSMENT_COMPLETED: 200,

  // Milestones
  MILESTONE_REACHED: 100,
  MILESTONE_STREAK: 25, // Per day for consecutive milestones
};

// Emotional Drive Scoring Rules
export const DRIVE_SCORING = {
  Diversity: {
    // Triggered by testing different controls/processes
    DIFFERENT_PROCESS: 15,
    DIFFERENT_CONTROL_TYPE: 10,
    DIFFERENT_TIME_OF_DAY: 5,
  },
  Belonging: {
    // Triggered by team participation
    TEAM_FLA: 20,
    PEER_FEEDBACK: 15,
    GROUP_ACTIVITY: 10,
  },
  Recognition: {
    // Triggered by achievements and being seen
    BADGE_EARNED: 25,
    POINTS_MILESTONE: 15,
    PUBLIC_CONTRIBUTION: 20,
  },
  Achievement: {
    // Triggered by completions
    CONTROL_COMPLETED: 15,
    FLA_COMPLETED: 25,
    MILESTONE_COMPLETED: 30,
  },
  Excellence: {
    // Triggered by high quality
    QUALITY_SCORE_90_PLUS: 25,
    PERFECT_EVIDENCE: 30,
    CONSISTENCY_BONUS: 15,
  },
  Growth: {
    // Triggered by learning and improvement
    NEW_CONTROL_TYPE: 20,
    QUALITY_IMPROVEMENT: 20,
    SKILL_EXPANSION: 15,
  },
  Contribution: {
    // Triggered by helping others
    DOCUMENT_FOR_TEAM: 20,
    MENTORING_SESSION: 25,
    IMPROVEMENT_IDENTIFIED: 20,
  },
  Security: {
    // Triggered by safety/compliance focus
    HSSE_CONTROL_TESTED: 20,
    COMPLIANCE_MAINTAINED: 15,
    RISK_MITIGATION: 25,
  },
};

/**
 * Look up active rules for an activity type and calculate points.
 *
 * @example
 *   // Closing an FLA — awards 5 pts "Conduct Assurance" + 1 pt per control
 *   const result = await calculatePointsFromRules("Complete Assessment", {
 *     controlCount: 5,
 *     isHsseCritical: false,
 *     qualityScore: 85,
 *   });
 *   // result = [{ gameAttributeId: "...", points: 10, ruleId: "..." }]
 *
 * @param activityType - Matches GameAttributeRule.activityType (e.g. "Complete Assessment")
 * @param context - Runtime values the rules can use (controlCount, isHsseCritical, qualityScore)
 * @returns Array of { gameAttributeId, points, ruleId } — one per matching active rule
 */
export async function calculatePointsFromRules(
  activityType: string,
  context: {
    controlCount?: number;
    isHsseCritical?: boolean;
    qualityScore?: number;
  } = {}
) {
  const rules = await prisma.gameAttributeRule.findMany({
    where: { activityType, isActive: true },
    include: { gameAttribute: true },
  });

  return rules.map((rule) => {
    let pts = rule.basePoints;

    // Per-control bonus (e.g. 1pt per associated control)
    if (rule.perControlPoints && context.controlCount) {
      pts += rule.perControlPoints * context.controlCount;
    }

    // HSSE-critical bonus
    if (rule.hsseBonusPoints && context.isHsseCritical) {
      pts += rule.hsseBonusPoints;
    }

    // Quality threshold bonus
    if (
      rule.qualityThreshold != null &&
      context.qualityScore != null &&
      context.qualityScore >= rule.qualityThreshold
    ) {
      pts += rule.qualityBonus;
    }

    // Apply multiplier
    pts = Math.round(pts * rule.multiplier);

    return {
      gameAttributeId: rule.gameAttributeId,
      gameAttributeName: rule.gameAttribute.attributeName,
      points: pts,
      ruleId: rule.id,
    };
  });
}

/**
 * Award points for an action.
 *
 * @param gameAttributeId - Links to GameAttribute that categorizes this XP
 * @param activityLogId    - Links to ActivityLog entry that triggered this award
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  emotionalDrive?: EmotionalDrive,
  assessmentId?: string,
  sampleId?: string,
  multiplier: number = 1.0,
  gameAttributeId?: string,
  activityLogId?: string | null
) {
  const actualPoints = Math.round(points * multiplier);

  await prisma.pointTransaction.create({
    data: {
      userId,
      points: actualPoints,
      reason,
      emotionalDrive,
      assessmentId,
      sampleId,
      multiplier,
      gameAttributeId,
      activityLogId,
    },
  });

  // Update user total points
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalPoints: user.totalPoints + actualPoints,
      },
    });
  }
}

/**
 * Update emotional drive metrics for a user
 */
export async function updateEmotionalDriveMetrics(
  userId: string,
  period: Date,
  drives: Partial<{
    diversity: number;
    belonging: number;
    recognition: number;
    achievement: number;
    excellence: number;
    growth: number;
    contribution: number;
    security: number;
  }>
) {
  const scores = {
    diversity: drives.diversity || 0,
    belonging: drives.belonging || 0,
    recognition: drives.recognition || 0,
    achievement: drives.achievement || 0,
    excellence: drives.excellence || 0,
    growth: drives.growth || 0,
    contribution: drives.contribution || 0,
    security: drives.security || 0,
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const overallEngagement = total > 0 ? Math.round((total / (8 * 100)) * 100) : 0;

  return prisma.emotionalDriveMetric.upsert({
    where: { userId_period: { userId, period } },
    update: {
      ...scores,
      overallEngagement,
    },
    create: {
      userId,
      period,
      ...scores,
      overallEngagement,
    },
  });
}

/**
 * Create or update milestone tracking
 */
export async function trackMilestone(
  userId: string,
  type: string,
  title: string,
  targetValue: number
) {
  const milestone = await prisma.milestone.findFirst({
    where: { userId, type },
  });

  if (milestone) {
    // Update current value
    return prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        currentValue: { increment: 1 },
        completedAt: milestone.currentValue + 1 >= targetValue ? new Date() : null,
      },
    });
  } else {
    // Create new milestone
    return prisma.milestone.create({
      data: {
        userId,
        type,
        title,
        targetValue,
        currentValue: 1,
        completedAt: 1 >= targetValue ? new Date() : null,
      },
    });
  }
}

/**
 * Award achievement badge to user
 */
export async function awardBadge(userId: string, badgeName: string) {
  const badge = await prisma.achievementBadge.findFirst({
    where: { badgeName: badgeName },
  });

  if (!badge) {
    console.error(`Badge not found: ${badgeName}`);
    return null;
  }

  try {
    const userAchievement = await prisma.userAchievement.create({
      data: {
        userId,
        badgeId: badge.id,
      },
      include: { badge: true },
    });

    // Award bonus points for badge
    await awardPoints(
      userId,
      POINT_RULES.MILESTONE_REACHED,
      `badge_earned_${badgeName}`,
      badge.emotionalDrive
    );

    return userAchievement;
  } catch (e: any) {
    if (e.code === "P2002") {
      // User already has this badge
      return null;
    }
    throw e;
  }
}

/**
 * Get user's gamification stats
 */
export async function getUserGamificationStats(userId: string) {
  const [user, achievements, points, milestones, drives] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { badge: true },
      }),
      prisma.pointTransaction.findMany({
        where: { userId },
      }),
      prisma.milestone.findMany({
        where: { userId },
      }),
      prisma.emotionalDriveMetric.findFirst({
        where: { userId },
        orderBy: { period: "desc" },
      }),
    ]);

  return {
    user,
    achievements,
    points: {
      total: points.reduce((sum, p) => sum + p.points, 0),
      transactions: points,
      thisWeek: points
        .filter((p) => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(p.createdAt) > weekAgo;
        })
        .reduce((sum, p) => sum + p.points, 0),
    },
    behaviors: {
      recent: [],
      streak: user?.dailyPointStreak || 0,
    },
    milestones: {
      active: milestones.filter((m) => !m.completedAt),
      completed: milestones.filter((m) => m.completedAt),
    },
    emotionalDrives: drives || {
      diversity: 0,
      belonging: 0,
      recognition: 0,
      achievement: 0,
      excellence: 0,
      growth: 0,
      contribution: 0,
      security: 0,
      overallEngagement: 0,
    },
  };
}

/**
 * Get leaderboard — points are SUM(PointTransaction.points) per user,
 * not the User.totalPoints column (which can drift).
 */
export async function getLeaderboard(
  limit: number = 10,
  comparisonUserId?: string
) {
  // Use raw query for accurate SUM from PointTransaction
  const leaderboard = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; totalPoints: number; dailyPointStreak: number; badgeCount: number }>
  >(`
    SELECT
      u."id",
      u."name",
      COALESCE(SUM(pt."points"), 0)::int AS "totalPoints",
      u."dailyPointStreak",
      COALESCE(COUNT(DISTINCT ua."id"), 0)::int AS "badgeCount"
    FROM "User" u
    LEFT JOIN "PointTransaction" pt ON pt."userId" = u."id"
    LEFT JOIN "UserAchievement" ua ON ua."userId" = u."id"
    WHERE u."username" != 'admin'
    GROUP BY u."id", u."name", u."dailyPointStreak"
    ORDER BY "totalPoints" DESC
    LIMIT $1
  `, limit);

  // Map to expected shape
  const users = leaderboard.map((u) => ({
    id: u.id,
    name: u.name,
    totalPoints: Number(u.totalPoints),
    dailyPointStreak: Number(u.dailyPointStreak),
    _count: { achievements: Number(u.badgeCount) },
  }));

  let userRank = null;
  if (comparisonUserId) {
    // Get user's SUM of points
    const userRow = await prisma.$queryRawUnsafe<
      Array<{ totalPoints: number }>
    >(`
      SELECT COALESCE(SUM("points"), 0)::int AS "totalPoints"
      FROM "PointTransaction"
      WHERE "userId" = $1
    `, comparisonUserId);

    const userPoints = userRow[0]?.totalPoints ?? 0;

    const betterCount = await prisma.$queryRawUnsafe<
      Array<{ count: number }>
    >(`
      SELECT COUNT(*)::int AS "count"
      FROM (
        SELECT pt."userId", SUM(pt."points") AS pts
        FROM "PointTransaction" pt
        JOIN "User" u ON u."id" = pt."userId"
        WHERE u."username" != 'admin'
        GROUP BY pt."userId"
      ) sub
      WHERE sub.pts > $1
    `, userPoints);

    userRank = Number(betterCount[0]?.count ?? 0) + 1;
  }

  return {
    leaderboard: users,
    userRank,
    totalUsers: await prisma.user.count({ where: { username: { not: 'admin' } } }),
  };
}
