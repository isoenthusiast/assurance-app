'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Effectiveness = 'Effective' | 'NotEffective' | null;

interface Assignment {
  id: string;
  effective: Effectiveness;
  effectiveUpdatedAt: string | Date | null;
  control: {
    id: string;
    name: string;
    processArea?: { name: string } | null;
    controlSubProcesses?: { subProcess: { name: string } }[];
  };
}

// Server components can pass Date instances straight through (Next.js RSC
// serialization supports Date natively), so accept either a Date, an ISO
// string, or null.
import { formatDate } from '@/lib/formatDate';

interface ReqGroup {
  rId: number;
  requirementId: string;
  clauseContent: string;
  controlIds: string[];
}

export default function AssignedControlsTable({
  initialAssignments,
  reqGroups,
}: {
  initialAssignments: Assignment[];
  reqGroups?: ReqGroup[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedReqs, setExpandedReqs] = useState<Set<number>>(new Set());

  const handleEffectivenessChange = async (id: string, value: string) => {
    const existing = assignments.find((a) => a.id === id);
    if (!existing) return;

    const effective: Effectiveness = value === '' ? null : (value as Effectiveness);

    setSavingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/control-assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effective }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update control assignment');
      }

      const updated = await res.json();
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, effective: updated.effective, effectiveUpdatedAt: updated.effectiveUpdatedAt }
            : a
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update control assignment');
    } finally {
      setSavingId(null);
    }
  };

  const handleUnassign = async (id: string, controlName: string) => {
    if (!confirm(`Unassign "${controlName}" from this assessment?`)) return;

    setUnassigningId(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/control-assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unassign control');
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      // The "Add or Remove Controls" checkbox selector holds its own copy
      // of which controls are assigned — refresh so it picks up this
      // removal too and doesn't accidentally re-create it on its next save.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unassign control');
    } finally {
      setUnassigningId(null);
    }
  };

  const sorted = [...assignments].sort((a, b) => a.control.name.localeCompare(b.control.name));
  const hasRequirements = reqGroups && reqGroups.length > 0;

  const toggleReq = (rId: number) => {
    setExpandedReqs(prev => {
      const next = new Set(prev);
      if (next.has(rId)) next.delete(rId); else next.add(rId);
      return next;
    });
  };

  return (
    <div className="border-t border-slate-200">
      <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span>ASSIGNED CONTROLS ({assignments.length})</span>
        {error && <span className="text-red-600 font-normal">❌ {error}</span>}
      </div>

      {hasRequirements ? (
        /* ── Requirement-grouped view ── */
        <div>
          {reqGroups!.map((rg) => {
            const isExpanded = expandedReqs.has(rg.rId);
            const reqAssignments = sorted.filter((a) => rg.controlIds.includes(a.control.id));
            if (reqAssignments.length === 0) return null;
            return (
              <div key={rg.rId} className="border-b border-slate-100 last:border-b-0">
                <button
                  onClick={() => toggleReq(rg.rId)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-700">{rg.requirementId}</span>
                    <span className="text-2xs text-slate-400 ml-2 truncate">
                      {rg.clauseContent.length > 80 ? rg.clauseContent.substring(0, 80) + '...' : rg.clauseContent}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-2xs text-slate-400">{reqAssignments.length} control(s)</span>
                    <span className="text-xs text-slate-300">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>
                {isExpanded && (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-700">Control</th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-700">Effective</th>
                        <th className="px-3 py-1.5 text-left font-medium text-slate-700">Date Updated</th>
                        <th className="px-3 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reqAssignments.map((ac) => (
                        <tr key={ac.id} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            <div className="font-medium text-slate-900">{ac.control.name}</div>
                            <div className="text-slate-500 text-2xs">
                              {ac.control.processArea?.name} / {ac.control.controlSubProcesses?.[0]?.subProcess?.name || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={ac.effective || ''}
                              disabled={savingId === ac.id}
                              onChange={(e) => handleEffectivenessChange(ac.id, e.target.value)}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                            >
                              <option value="">Select One</option>
                              <option value="Effective">Effective</option>
                              <option value="NotEffective">Not Effective</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{formatDate(ac.effectiveUpdatedAt)}</td>
                          <td className="px-3 py-1.5 text-right">
                            <button
                              onClick={() => handleUnassign(ac.id, ac.control.name)}
                              disabled={unassigningId === ac.id}
                              className="text-red-600 hover:underline font-medium disabled:text-slate-400 text-2xs"
                            >
                              {unassigningId === ac.id ? '...' : 'Unassign'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat list (no requirement data) ── */
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Control</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Effective</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Date Updated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ac) => (
              <tr key={ac.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{ac.control.name}</div>
                  <div className="text-slate-500 text-xs">
                    {ac.control.processArea?.name} / {ac.control.controlSubProcesses?.[0]?.subProcess?.name || "—"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={ac.effective || ''}
                    disabled={savingId === ac.id}
                    onChange={(e) => handleEffectivenessChange(ac.id, e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                  >
                    <option value="">Select One</option>
                    <option value="Effective">Effective</option>
                    <option value="NotEffective">Not Effective</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-600">{formatDate(ac.effectiveUpdatedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleUnassign(ac.id, ac.control.name)}
                    disabled={unassigningId === ac.id}
                    className="text-red-600 hover:underline font-medium disabled:text-slate-400"
                  >
                    {unassigningId === ac.id ? 'Unassigning...' : 'Unassign'}
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                  No controls assigned yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
