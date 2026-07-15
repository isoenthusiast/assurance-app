'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/formatDate';

interface ProcessHealth {
  processAreaId: string;
  processAreaName: string;
  standard: string;
  avgHealth: number;
  controlCount: number;
}

interface AssessmentInProgress {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  totalSamples: number;
  testedSamples: number;
}

function getHealthEmoji(score: number): { emoji: string; label: string } {
  if (score > 80) return { emoji: '🟢', label: 'Healthy' };
  if (score >= 50) return { emoji: '🟡', label: 'Tolerable' };
  return { emoji: '🔴', label: 'Not Tolerable' };
}

export default function ProcessHealthDashboard({
  processes,
  assessments,
}: {
  processes: ProcessHealth[];
  assessments: AssessmentInProgress[];
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionOpen, setSectionOpen] = useState(true);
  const [assessmentsOpen, setAssessmentsOpen] = useState(true);

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

  const toggle = (std: string) => setExpanded(prev => ({ ...prev, [std]: !prev[std] }));

  return (
    <div className="space-y-4">
      {/* ── Collapsible: Standard Health ── */}
      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setSectionOpen(prev => !prev)}
          className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 flex items-center justify-between"
        >
          <span className="text-sm font-semibold text-slate-800">📊 Standard Health</span>
          <span className="text-xs text-slate-400">{sectionOpen ? '▼ Collapse' : '▶ Expand'}</span>
        </button>
        {sectionOpen && (
          <div className="p-4 space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-500 bg-white rounded border border-slate-200 px-4 py-2">
              <span className="font-medium text-slate-600">Legend:</span>
              <span className="flex items-center gap-1"><span className="text-base">🟢</span> &gt;80 Healthy</span>
              <span className="flex items-center gap-1"><span className="text-base">🟡</span> 50–80 Tolerable</span>
              <span className="flex items-center gap-1"><span className="text-base">🔴</span> &lt;50 Not Tolerable</span>
            </div>

            {Object.entries(grouped).map(([standard, items]) => {
        const totalControls = items.reduce((sum, p) => sum + p.controlCount, 0);
        const avgStandard = items.reduce((sum, p) => sum + p.avgHealth, 0) / items.length;
        const { emoji, label } = getHealthEmoji(avgStandard);
        const isExpanded = !!expanded[standard];

        return (
          <div key={standard} className="rounded border border-slate-200 bg-white">
            <button
              onClick={() => toggle(standard)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0" title={label}>{emoji}</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{standard}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400">
                <span>{Math.round(avgStandard)}% avg</span>
                <span>·</span>
                <span>{totalControls} controls</span>
                <span>·</span>
                <span>{items.length} areas</span>
                <span className="text-slate-300">{isExpanded ? '▼' : '▶'}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="divide-y divide-slate-100 border-t border-slate-200">
                {items.map((p) => {
                  const { emoji: pEmoji, label: pLabel } = getHealthEmoji(p.avgHealth);
                  return (
                    <div key={p.processAreaId} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0" title={pLabel}>{pEmoji}</span>
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
            )}
          </div>
        );
      })}
          </div>
        )}
      </div>

      {/* ── Collapsible: Assessments in Progress ── */}
      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setAssessmentsOpen(prev => !prev)}
          className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 flex items-center justify-between"
        >
          <span className="text-sm font-semibold text-slate-800">📋 Assessments in Progress</span>
          <span className="text-xs text-slate-400">{assessmentsOpen ? '▼ Collapse' : '▶ Expand'}</span>
        </button>
        {assessmentsOpen && (
          <div className="p-0">
            {assessments.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                No assessments in progress.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Assessment</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Start Date</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Samples</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/fla/${a.id}`} className="text-blue-600 hover:underline font-medium">
                          {a.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {formatDate(a.startDate)}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {a.testedSamples}/{a.totalSamples} tested
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          a.status === 'Planned' ? 'bg-slate-100 text-slate-700' :
                          a.status === 'InProgress' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
