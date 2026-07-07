'use client';

import React, { useEffect, useState } from 'react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, leaderboardRes] = await Promise.all([
          fetch(`/api/gamification/stats/${userId}`),
          fetch(`/api/gamification/leaderboard?userId=${userId}`),
        ]);

        if (!statsRes.ok || !leaderboardRes.ok) {
          throw new Error(`API error: ${statsRes.status}, ${leaderboardRes.status}`);
        }

        const statsData = await statsRes.json();
        const leaderboardData = await leaderboardRes.json();

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

      {/* Active Milestones */}
      <MilestoneTracker milestones={stats.milestones} />

      {/* Leaderboard */}
      <LeaderboardCard leaderboard={leaderboard} userRank={userRank} stats={stats} />

      {/* Behavior Trends */}
      <BehaviorTrends behaviors={stats.behaviors} />

      {/* Badge Gallery */}
      <BadgeGallery achievements={stats.achievements} />
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
  stats,
}: {
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  stats: GamificationStats;
}) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Leaderboard</h2>
        <p className="text-slate-500">No leaderboard data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Leaderboard</h2>

      {userRank && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
          You are ranked <span className="font-bold text-blue-900">#{userRank}</span> out of{' '}
          {leaderboard.length + (userRank > leaderboard.length ? 1 : 0)} assessors
        </div>
      )}

      <div className="space-y-2">
        {leaderboard.map((user, idx) => (
          <div
            key={user.id}
            className={`flex items-center justify-between p-2 rounded ${
              idx < 3 ? 'bg-amber-50' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-600 w-6">#{idx + 1}</span>
              {idx < 3 && <span className="text-lg">{['🥇', '🥈', '🥉'][idx]}</span>}
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
      </div>
    </div>
  );
}

function BehaviorTrends({ behaviors }: { behaviors: GamificationStats['behaviors'] }) {
  if (!behaviors || !behaviors.recent) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-500">No behavior data yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Weekly Activity</h2>
      <div className="space-y-3">
        {behaviors.recent.slice(0, 7).map((b, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-8">
              {new Date(b.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <div className="flex-1 flex gap-1">
              {Array.from({ length: b.plansMade }).map((_, i) => (
                <span key={`p-${i}`} className="text-xs">📋</span>
              ))}
              {Array.from({ length: b.controlsTested }).map((_, i) => (
                <span key={`c-${i}`} className="text-xs">✅</span>
              ))}
              {Array.from({ length: b.evidenceDocumented }).map((_, i) => (
                <span key={`e-${i}`} className="text-xs">📝</span>
              ))}
              {b.teamEngagement && <span className="text-xs">👥</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-slate-500">
        📋 = Plan · ✅ = Control Tested · 📝 = Evidence · 👥 = Team Activity
      </div>
    </div>
  );
}

function BadgeGallery({ achievements }: { achievements: any[] }) {
  if (!achievements) {
    achievements = [];
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Badge Gallery</h2>
      {achievements && achievements.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className="p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded border border-amber-200 text-center"
            >
              <div className="text-3xl mb-1">
                {a.badge.emotionalDrive === 'Recognition'
                  ? '⭐'
                  : a.badge.emotionalDrive === 'Growth'
                  ? '📈'
                  : a.badge.emotionalDrive === 'Excellence'
                  ? '💎'
                  : '🏆'}
              </div>
              <p className="text-xs font-medium text-slate-900">{a.badge.name}</p>
              <p className="text-xs text-slate-600 mt-1">
                {new Date(a.earnedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Complete activities to earn badges! Start by planning an FLA.
        </p>
      )}
    </div>
  );
}
