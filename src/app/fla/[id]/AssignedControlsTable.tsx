'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Effectiveness = 'Effective' | 'NotEffective' | null;

interface Assignment {
  id: string;
  effective: Effectiveness;
  effectiveUpdatedAt: string | Date | null;
  lastTestedDate: string | Date | null;
  control: {
    name: string;
    processArea?: { name: string } | null;
    subProcess?: { name: string } | null;
  };
}

// Server components can pass Date instances straight through (Next.js RSC
// serialization supports Date natively), so accept either a Date, an ISO
// string, or null.
function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function AssignedControlsTable({
  initialAssignments,
}: {
  initialAssignments: Assignment[];
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mt-4 border border-slate-200 rounded overflow-hidden">
      <div className="text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <span>ASSIGNED CONTROLS ({assignments.length})</span>
        {error && <span className="text-red-600 font-normal">❌ {error}</span>}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-700">Control</th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">Effective</th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">Date Updated</th>
            <th className="px-3 py-2 text-left font-medium text-slate-700">Last Tested Date</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ac) => (
            <tr key={ac.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{ac.control.name}</div>
                <div className="text-slate-500 text-xs">
                  {ac.control.processArea?.name} / {ac.control.subProcess?.name}
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
              <td className="px-3 py-2 text-slate-600" title="Follows the assessment's end date">
                {formatDate(ac.lastTestedDate)}
              </td>
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
              <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                No controls assigned yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
