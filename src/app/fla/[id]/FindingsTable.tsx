'use client';

import { useState, Fragment, forwardRef, useImperativeHandle } from 'react';
import ActionsPanel, { ActionItem } from './ActionsPanel';

type Severity = 'Low' | 'Medium' | 'High' | 'Serious';

interface AssignedControl {
  id: string;
  name: string;
}

interface SampleOption {
  id: string;
  recordReference: string | null;
  sampleType?: { name: string } | null;
}

export interface Finding {
  id: string;
  assessmentId: string;
  sampleId: string | null;
  description: string;
  details: string | null;
  controlIds: string | null;
  risks: string | null;
  repeat: boolean;
  severity: Severity;
  createdAt: string | Date;
  actions: ActionItem[];
  sample?: SampleOption | null;
}

const severityStyles: Record<Severity, string> = {
  Low: 'bg-slate-100 text-slate-700',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Serious: 'bg-red-100 text-red-700',
};

const emptyForm = {
  description: '',
  details: '',
  controlIds: [] as string[],
  sampleId: '',
  risks: '',
  repeat: false,
  severity: 'Low' as Severity,
};

function sampleLabel(sample?: SampleOption | null) {
  if (!sample) return null;
  return `${sample.sampleType?.name || 'Sample'}${sample.recordReference ? ` — ${sample.recordReference}` : ''}`;
}

export interface FindingsTableHandle {
  /** Opens the Add Finding modal, optionally pre-selecting a sample (used by
   * the "+ Finding" shortcut on each Samples row). */
  openAddModal: (sampleId?: string) => void;
}

const FindingsTable = forwardRef<
  FindingsTableHandle,
  {
    assessmentId: string;
    initialFindings: Finding[];
    assignedControls: AssignedControl[];
    samples: SampleOption[];
  }
>(function FindingsTable({ assessmentId, initialFindings, assignedControls, samples }, ref) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const controlName = (controlId: string) =>
    assignedControls.find((c) => c.id === controlId)?.name || controlId;

  const parseControlIds = (value: string | null) => (value ? value.split('|').filter(Boolean) : []);

  const openAddModal = (sampleId?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, sampleId: sampleId || '' });
    setError(null);
    setShowModal(true);
  };

  useImperativeHandle(ref, () => ({ openAddModal }));

  const openEditModal = (finding: Finding) => {
    setEditingId(finding.id);
    setForm({
      description: finding.description,
      details: finding.details || '',
      controlIds: parseControlIds(finding.controlIds),
      sampleId: finding.sampleId || '',
      risks: finding.risks || '',
      repeat: finding.repeat,
      severity: finding.severity,
    });
    setError(null);
    setShowModal(true);
  };

  const toggleControl = (controlId: string) => {
    setForm((prev) => ({
      ...prev,
      controlIds: prev.controlIds.includes(controlId)
        ? prev.controlIds.filter((id) => id !== controlId)
        : [...prev.controlIds, controlId],
    }));
  };

  const handleSave = async () => {
    if (!form.description.trim()) {
      setError('Finding description is required');
      return;
    }
    if (form.controlIds.length === 0) {
      setError('At least one control must be selected. Findings must be linked to a control.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        assessmentId,
        sampleId: form.sampleId || null,
        description: form.description,
        details: form.details || null,
        controlIds: form.controlIds,
        risks: form.risks || null,
        repeat: form.repeat,
        severity: form.severity,
      };

      const res = editingId
        ? await fetch(`/api/admin/findings/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/findings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save finding');
      }

      const saved = await res.json();
      setFindings((prev) =>
        editingId ? prev.map((f) => (f.id === editingId ? saved : f)) : [...prev, saved]
      );
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save finding');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (findingId: string) => {
    if (!confirm('Delete this finding? Its actions will be deleted too.')) return;

    try {
      const res = await fetch(`/api/admin/findings/${findingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete finding');
      setFindings(findings.filter((f) => f.id !== findingId));
      if (expandedId === findingId) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete finding');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Findings ({findings.length})</h3>
        <button
          onClick={() => openAddModal()}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
        >
          + Add Finding
        </button>
      </div>

      {error && !showModal && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Finding ID</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Description</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Controls</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Sample</th>
              <th className="px-4 py-3 text-center font-medium text-slate-700">Repeat</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Severity</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Actions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => {
              const controlIds = parseControlIds(finding.controlIds);
              const isExpanded = expandedId === finding.id;
              return (
                <Fragment key={finding.id}>
                  <tr className="border-t border-slate-200 hover:bg-slate-50 align-top">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{finding.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{finding.description}</div>
                      {finding.details && (
                        <div
                          className="text-xs text-slate-500 mt-0.5 max-w-xs truncate"
                          title={finding.details}
                        >
                          {finding.details}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
                      {controlIds.length === 0
                        ? '—'
                        : controlIds.map((id) => controlName(id)).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {sampleLabel(finding.sample) || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{finding.repeat ? 'Y' : 'N'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${severityStyles[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100"
                      >
                        {isExpanded ? '▲' : '▼'} Actions ({finding.actions.length})
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(finding)}
                        className="text-blue-600 hover:underline text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(finding.id)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={8} className="px-4 py-3">
                        <ActionsPanel findingId={finding.id} initialActions={finding.actions} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {findings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No findings added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Finding Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-4">
              {editingId ? 'Edit Finding' : 'Add Finding'}
            </h3>

            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                ❌ {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Finding Description (1-liner) *
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Finding Details
                </label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  rows={3}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Controls (from this assessment)
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded p-2">
                  {assignedControls.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No controls are assigned to this assessment yet.
                    </p>
                  ) : (
                    assignedControls.map((c) => (
                      <label key={c.id} className="flex items-start gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.controlIds.includes(c.id)}
                          onChange={() => toggleControl(c.id)}
                          className="mt-0.5 rounded"
                        />
                        <span>{c.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sample (optional)
                </label>
                <select
                  value={form.sampleId}
                  onChange={(e) => setForm({ ...form, sampleId: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Not tied to a specific sample</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sampleLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Risks</label>
                <textarea
                  value={form.risks}
                  onChange={(e) => setForm({ ...form, risks: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Repeat</label>
                  <select
                    value={form.repeat ? 'Y' : 'N'}
                    onChange={(e) => setForm({ ...form, repeat: e.target.value === 'Y' })}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="N">N</option>
                    <option value="Y">Y</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Serious">Serious</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:bg-slate-400"
              >
                {editingId ? 'Save Changes' : 'Add Finding'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError(null);
                }}
                className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FindingsTable;
