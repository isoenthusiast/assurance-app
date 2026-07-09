'use client';

import Link from 'next/link';

interface ProcessHealth {
  processAreaId: string;
  processAreaName: string;
  standard: string;
  avgHealth: number;
  controlCount: number;
}

function getHealthEmoji(score: number): { emoji: string; label: string } {
  if (score > 80) return { emoji: '🟢', label: 'Healthy' };
  if (score >= 50) return { emoji: '🟡', label: 'Tolerable' };
  return { emoji: '🔴', label: 'Not Tolerable' };
}

export default function ProcessHealthDashboard({
  processes,
}: {
  processes: ProcessHealth[];
}) {
  if (processes.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        No process health data available.
      </div>
    );
  }

  // Group by standard
  const grouped: Record<string, ProcessHealth[]> = {};
  for (const p of processes) {
    const std = p.standard || 'Uncategorized';
    if (!grouped[std]) grouped[std] = [];
    grouped[std].push(p);
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([standard, items]) => (
        <div key={standard} className="rounded border border-slate-200 bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{standard}</span>
            <span className="text-xs text-slate-400 ml-2">({items.length} process areas)</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((p) => {
              const { emoji, label } = getHealthEmoji(p.avgHealth);
              return (
                <div key={p.processAreaId} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0" title={label}>{emoji}</span>
                    <Link
                      href={`/setup/processdetails/${p.processAreaId}`}
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {p.processAreaName}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.avgHealth > 80 ? 'bg-green-500' : p.avgHealth >= 50 ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(p.avgHealth, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-500 w-8 text-right">{Math.round(p.avgHealth)}%</span>
                    <span className="text-xs text-slate-400 w-16 text-right">{p.controlCount} controls</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 bg-white rounded border border-slate-200 px-4 py-2">
        <span className="font-medium text-slate-600">Legend:</span>
        <span className="flex items-center gap-1"><span className="text-base">🟢</span> &gt;80 Healthy</span>
        <span className="flex items-center gap-1"><span className="text-base">🟡</span> 50–80 Tolerable</span>
        <span className="flex items-center gap-1"><span className="text-base">🔴</span> &lt;50 Not Tolerable</span>
      </div>
    </div>
  );
}
