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
 * Award points for an action
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  emotionalDrive?: EmotionalDrive,
  assessmentId?: string,
  sampleId?: string,
  multiplier: number = 1.0
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
 * Record daily behavior measurement
 */
export async function recordDailyBehavior(
  userId: string,
  date: Date,
  data: {
    plansMade?: number;
    controlsTested?: number;
    evidenceDocumented?: number;
    teamEngagement?: boolean;
    qualityScore?: number;
  }
) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return prisma.behaviorMeasurement.upsert({
    where: { userId_date: { userId, date: today } },
    update: {
      plansMade: { increment: data.plansMade || 0 },
      controlsTested: { increment: data.controlsTested || 0 },
      evidenceDocumented: { increment: data.evidenceDocumented || 0 },
      teamEngagement: data.teamEngagement || false,
      qualityScore: data.qualityScore || 0,
    },
    create: {
      userId,
      date: today,
      plansMade: data.plansMade || 0,
      controlsTested: data.controlsTested || 0,
      evidenceDocumented: data.evidenceDocumented || 0,
      teamEngagement: data.teamEngagement || false,
      qualityScore: data.qualityScore || 0,
    },
  });
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
  const [user, achievements, points, behaviors, milestones, drives] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { badge: true },
      }),
      prisma.pointTransaction.findMany({
        where: { userId },
      }),
      prisma.behaviorMeasurement.findMany({
        where: { userId },
        orderBy: { date: "desc" },
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
      total: user?.totalPoints || 0,
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
      recent: behaviors.slice(0, 7),
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
 * Get leaderboard (both global and personal progress comparison)
 */
export async function getLeaderboard(
  limit: number = 10,
  comparisonUserId?: string
) {
  const users = await prisma.user.findMany({
    orderBy: { totalPoints: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      totalPoints: true,
      dailyPointStreak: true,
      _count: {
        select: {
          achievements: true,
        },
      },
    },
  });

  let userRank = null;
  if (comparisonUserId) {
    const userPosition = await prisma.user.findUnique({
      where: { id: comparisonUserId },
      select: { totalPoints: true },
    });

    if (userPosition) {
      const betterCount = await prisma.user.count({
        where: {
          totalPoints: { gt: userPosition.totalPoints },
        },
      });
      userRank = betterCount + 1;
    }
  }

  return {
    leaderboard: users,
    userRank,
    totalUsers: await prisma.user.count(),
  };
}
