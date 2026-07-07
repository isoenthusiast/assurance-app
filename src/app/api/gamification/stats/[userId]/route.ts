import { NextRequest, NextResponse } from 'next/server';
import { getUserGamificationStats } from '@/lib/gamification';

const DEFAULT_STATS = {
  user: null,
  achievements: [],
  points: { total: 0, thisWeek: 0, transactions: [] },
  behaviors: { recent: [], streak: 0 },
  milestones: { active: [], completed: [] },
  emotionalDrives: {
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json(DEFAULT_STATS);
    }

    const stats = await getUserGamificationStats(userId);

    // Ensure response has the right structure
    if (!stats || typeof stats !== 'object') {
      return NextResponse.json(DEFAULT_STATS);
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching gamification stats:', error);
    // Return default stats instead of error so UI doesn't crash
    return NextResponse.json(DEFAULT_STATS);
  }
}
