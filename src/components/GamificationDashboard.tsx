'use client';

import React, { useEffect, useState } from 'react';
import { formatDate } from '@/lib/formatDate';

interface GamificationStats {
  user: any;
  achievements: any[];
  points: {
    total: number;
    thisWeek: number;
    transactions: any[];
  };
  behaviors: {
    recent: any[];
    streak: number;
  };
  milestones: {
    active: any[];
    completed: any[];
  };
  emotionalDrives: {
    diversity: number;
    belonging: number;
    recognition: number;
    achievement: number;
    excellence: number;
    growth: number;
    contribution: number;
    security: number;
    overallEngagement: number;
  };
}

interface LeaderboardEntry {
  id: string;
  name: string;
  totalPoints: number;
  dailyPointStreak: number;
  _count: { achievements: number };
}

export function GamificationDashboard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, leaderboardRes, badgesRes] = await Promise.all([
          fetch(`/api/gamification/stats/${userId}`),
          fetch(`/api/gamification/leaderboard?userId=${userId}&limit=50`),
          fetch(`/api/admin/badges`),
        ]);

        if (!statsRes.ok || !leaderboardRes.ok) {
          throw new Error(`API error: ${statsRes.status}, ${leaderboardRes.status}`);
        }

        const statsData = await statsRes.json();
        const leaderboardData = await leaderboardRes.json();

        // Fetch all available badges for the gallery
        if (badgesRes.ok) {
          const badgesData = await badgesRes.json();
          setAllBadges(Array.isArray(badgesData) ? badgesData : []);
        }

        // Ensure stats has the right structure
        if (statsData && typeof statsData === 'object') {
          setStats(statsData);
        } else {
          console.error('Invalid stats data:', statsData);
          setStats({
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
          });
        }

        setLeaderboard(leaderboardData?.leaderboard ?? []);
        setUserRank(leaderboardData?.userRank ?? null);
        setTotalUsers(leaderboardData?.totalUsers ?? 0);
      } catch (error) {
        console.error('Failed to fetch gamification data:', error);
        // Set default empty stats
        setStats({
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
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-100 rounded" />
        <div className="h-32 bg-slate-100 rounded" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-slate-500">Failed to load gamification stats</div>;
  }

  return (
    <div className="space-y-6">
      {/* Points & Achievements Overview */}
      <div className="grid grid-cols-2 gap-4">
        <PointsCard stats={stats} />
        <AchievementsCard stats={stats} />
      </div>

      {/* Leaderboard */}
      <LeaderboardCard leaderboard={leaderboard} userRank={userRank} totalUsers={totalUsers} stats={stats} />

      {/* Badge Gallery */}
      <BadgeGallery achievements={stats.achievements} allBadges={allBadges} />
    </div>
  );
}

function PointsCard({ stats }: { stats: GamificationStats }) {
  const total = stats?.points?.total ?? 0;
  const thisWeek = stats?.points?.thisWeek ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Total Points</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{total}</p>
          <p className="text-xs text-slate-500 mt-1">+{thisWeek} this week</p>
        </div>
        <div className="text-5xl">🏆</div>
      </div>
    </div>
  );
}

function AchievementsCard({ stats }: { stats: GamificationStats }) {
  const badgeCount = stats?.achievements?.length ?? 0;
  const streak = stats?.behaviors?.streak ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Badges Earned</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{badgeCount}</p>
          <p className="text-xs text-slate-500 mt-1">Day streak: {streak}</p>
        </div>
        <div className="text-5xl">⭐</div>
      </div>
    </div>
  );
}

function MilestoneTracker({
  milestones,
}: {
  milestones: GamificationStats['milestones'];
}) {
  if (!milestones) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-500">No milestone data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Milestones</h2>
      {milestones?.active && milestones.active.length > 0 ? (
        <div className="space-y-3">
          {milestones.active.map((m) => {
            const percentage = (m.currentValue / m.targetValue) * 100;
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">{m.title}</span>
                  <span className="text-xs text-slate-500">
                    {m.currentValue}/{m.targetValue}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No active milestones. Plan an FLA to get started!</p>
      )}

      {milestones?.completed && milestones.completed.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-slate-600 mb-2">
            Completed ({milestones.completed.length})
          </p>
          <div className="space-y-1">
            {milestones.completed.slice(0, 3).map((m) => (
              <div key={m.id} className="text-xs text-slate-500">
                ✓ {m.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeaderboardCard({
  leaderboard,
  userRank,
  totalUsers,
  stats,
}: {
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  totalUsers: number;
  stats: GamificationStats;
}) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Assurance Leaderboard</h2>
        <p className="text-slate-500">No leaderboard data yet.</p>
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const userId = stats?.user?.id;
  const userInTop3 = top3.some(u => u.id === userId);
  const userEntry = userId ? leaderboard.find(u => u.id === userId) : null;
  const userIdx = userEntry ? leaderboard.indexOf(userEntry) : -1;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Assurance Leaderboard</h2>

      {userRank && (
        <div className="mb-4 p-2 bg-blue-50 rounded text-xs text-slate-700">
          You rank <span className="font-bold text-blue-900">#{userRank}</span> of{' '}
          <span className="font-bold">{totalUsers}</span> members
        </div>
      )}

      <div className="space-y-2">
        {/* Top 3 */}
        {top3.map((user, idx) => (
          <div
            key={user.id}
            className={`flex items-center justify-between p-2 rounded ${user.id === userId ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-amber-50'}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-600 w-6">#{idx + 1}</span>
              <span className="text-lg">{['🥇', '🥈', '🥉'][idx]}</span>
              <div>
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user._count.achievements} badges</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{user.totalPoints} pts</p>
              <p className="text-xs text-slate-500">
                {user.dailyPointStreak > 0 && `${user.dailyPointStreak}🔥`}
              </p>
            </div>
          </div>
        ))}

        {/* Gap + User (if user not in top 3 and user is found) */}
        {!userInTop3 && userEntry && (
          <>
            <div className="text-center text-xs text-slate-300 py-1">···</div>
            <div className="flex items-center justify-between p-2 rounded bg-blue-50 ring-1 ring-blue-200">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-600 w-6">#{userIdx + 1}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{userEntry.name}</p>
                  <p className="text-xs text-slate-500">{userEntry._count.achievements} badges</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{userEntry.totalPoints} pts</p>
                <p className="text-xs text-slate-500">
                  {userEntry.dailyPointStreak > 0 && `${userEntry.dailyPointStreak}🔥`}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Gap + End of list */}
        <div className="text-center text-xs text-slate-300 py-1">···</div>
        <div className="text-center text-xs text-slate-400 py-1">End of list</div>
      </div>
    </div>
  );
}

function BadgeGallery({ achievements, allBadges }: { achievements: any[]; allBadges?: any[] }) {
  if (!achievements) {
    achievements = [];
  }

  // Show only earned badges
  const displayBadges = achievements.map(a => ({ ...a.badge, earnedAt: a.earnedAt }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Badge Gallery</h2>
      {displayBadges.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
          {displayBadges.map((b) => (
            <div
              key={b.id}
              className={`p-2 rounded-lg border text-center hover:shadow-md transition-shadow ${b.earnedAt ? 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}
              title={b.description || b.badgeName}
            >
              {b.badgeImage ? (
                <img
                  src={b.badgeImage}
                  alt={b.badgeName}
                  className="w-full h-auto max-h-16 object-contain mx-auto mb-1"
                />
              ) : (
                <div className="text-2xl mb-1">{b.icon || "🏆"}</div>
              )}
              <p className="text-xs font-medium text-slate-900 leading-tight truncate">{b.badgeName}</p>
              {b.level && (
                <p className="text-xs text-slate-500">{b.level}</p>
              )}
              {b.earnedAt && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(b.earnedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No badges earned yet. Complete assessments to earn badges.
        </p>
      )}
    </div>
  );
}
