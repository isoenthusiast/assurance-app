import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/gamification';

const DEFAULT_LEADERBOARD = {
  leaderboard: [],
  userRank: null,
  totalUsers: 0,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId') || undefined;

    const leaderboard = await getLeaderboard(limit, userId);

    if (!leaderboard || typeof leaderboard !== 'object') {
      return NextResponse.json(DEFAULT_LEADERBOARD);
    }

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // Return default instead of error so UI doesn't crash
    return NextResponse.json(DEFAULT_LEADERBOARD);
  }
}
