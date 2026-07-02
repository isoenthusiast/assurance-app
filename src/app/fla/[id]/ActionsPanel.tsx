'use client';

import { useState } from 'react';

export interface ActionItem {
  id: string;
  actionDescription: string;
  actionDetails: string | null;
  actionParty: string | null;
  auditee: string | null;
  createdDate: string | Date;
  targetDate: string | Date | null;
  apAgreed: boolean;
  originalTargetDate: string | Date | null;
  numberOfExtensions: number;
  actionClosureEffective: boolean;
  actionClosureApprovedBy: string | null;
}

const emptyForm = {
  actionDescription: '',
  actionDetails: '',
  actionParty: '',
  auditee: '',
  targetDate: '',
  apAgreed: false,
  actionClosureEffective: false,
  actionClosureApprovedBy: '',
};

// Server components can pass Date instances straight through to client
// components (Next.js RSC serialization supports Date natively), so these
// helpers accept either a Date, an ISO string, or null/undefined.
function toDateInput(value: string | Date | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function ActionsPanel({
  findingId,
  initialActions,
}: {
  findingId: string;
  initialActions: ActionItem[];
}) {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof emptyForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddAction = async () => {
    if (!newAction.actionDescription.trim()) {
      setError('Action description is required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId, ...newAction }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add action');
      }

      const created = await res.json();
      setActions([...actions, created]);
      setShowAddAction(false);
      setNewAction(emptyForm);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add action');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (action: ActionItem) => {
    setEditingId(action.id);
    setEditForm({
      actionDescription: action.actionDescription,
      actionDetails: action.actionDetails || '',
      actionParty: action.actionParty || '',
      auditee: action.auditee || '',
      targetDate: toDateInput(action.targetDate),
      apAgreed: action.apAgreed,
      actionClosureEffective: action.actionClosureEffective,
      actionClosureApprovedBy: action.actionClosureApprovedBy || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.actionDescription.trim()) {
      setError('Action description is required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/admin/actions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update action');
      }

      const updated = await res.json();
      setActions(actions.map((a) => (a.id === editingId ? updated : a)));
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update action');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (actionId: string) => {
    if (!confirm('Delete this action?')) return;

    try {
      const res = await fetch(`/api/admin/actions/${actionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete action');
      setActions(actions.filter((a) => a.id !== actionId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete action');
    }
  };

  return (
    <div className="space-y-3 bg-slate-50 rounded border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase text-slate-600">
          Actions ({actions.length})
        </h4>
        <button
          onClick={() => setShowAddAction(true)}
          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
        >
          + Add Action
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200 bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Description</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Party</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Auditee</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Created</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Target Date</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">AP Agreed</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Orig. Target</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Ext.</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">Closure Effective</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Closed By</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-t border-slate-100 align-top">
                {editingId === action.id ? (
                  <td colSpan={11} className="px-3 py-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Action Description *
                        </label>
                        <input
                          type="text"
                          value={editForm.actionDescription}
                          onChange={(e) =>
                            setEditForm({ ...editForm, actionDescription: e.target.value })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Action Details
                        </label>
                        <textarea
                          value={editForm.actionDetails}
                          onChange={(e) =>
                            setEditForm({ ...editForm, actionDetails: e.target.value })
                          }
                          rows={2}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Action Party
                        </label>
                        <input
                          type="text"
                          value={editForm.actionParty}
                          onChange={(e) => setEditForm({ ...editForm, actionParty: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Auditee
                        </label>
                        <input
                          type="text"
                          value={editForm.auditee}
                          onChange={(e) => setEditForm({ ...editForm, auditee: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Target Date
                        </label>
                        <input
                          type="date"
                          value={editForm.targetDate}
                          onChange={(e) => setEditForm({ ...editForm, targetDate: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">
                          Changing this counts as an extension after the first save.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          checked={editForm.apAgreed}
                          onChange={(e) => setEditForm({ ...editForm, apAgreed: e.target.checked })}
                          className="rounded"
                        />
                        <label className="text-xs text-slate-700">AP Agreed</label>
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          checked={editForm.actionClosureEffective}
                          onChange={(e) =>
                            setEditForm({ ...editForm, actionClosureEffective: e.target.checked })
                          }
                          className="rounded"
                        />
                        <label className="text-xs text-slate-700">Closure Effective</label>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Closure Approved By
                        </label>
                        <input
                          type="text"
                          value={editForm.actionClosureApprovedBy}
                          onChange={(e) =>
                            setEditForm({ ...editForm, actionClosureApprovedBy: e.target.value })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-3 text-right space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:bg-slate-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{action.actionDescription}</div>
                      {action.actionDetails && (
                        <div
                          className="text-slate-500 text-xs mt-0.5 max-w-xs truncate"
                          title={action.actionDetails}
                        >
                          {action.actionDetails}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{action.actionParty || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{action.auditee || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(action.createdDate)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(action.targetDate)}</td>
                    <td className="px-3 py-2 text-center">{action.apAgreed ? '✓' : '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(action.originalTargetDate)}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{action.numberOfExtensions}</td>
                    <td className="px-3 py-2 text-center">
                      {action.actionClosureEffective ? '✓' : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{action.actionClosureApprovedBy || '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(action)}
                        className="text-blue-600 hover:underline text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {actions.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-slate-400">
                  No actions added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-4">Add Action</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Action Description *
                </label>
                <input
                  type="text"
                  value={newAction.actionDescription}
                  onChange={(e) =>
                    setNewAction({ ...newAction, actionDescription: e.target.value })
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Action Details
                </label>
                <textarea
                  value={newAction.actionDetails}
                  onChange={(e) => setNewAction({ ...newAction, actionDetails: e.target.value })}
                  rows={3}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Action Party
                  </label>
                  <input
                    type="text"
                    value={newAction.actionParty}
                    onChange={(e) => setNewAction({ ...newAction, actionParty: e.target.value })}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Auditee</label>
                  <input
                    type="text"
                    value={newAction.auditee}
                    onChange={(e) => setNewAction({ ...newAction, auditee: e.target.value })}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={newAction.targetDate}
                  onChange={(e) => setNewAction({ ...newAction, targetDate: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newAction.apAgreed}
                  onChange={(e) => setNewAction({ ...newAction, apAgreed: e.target.checked })}
                  className="rounded"
                />
                <label className="text-xs font-medium text-slate-700">AP Agreed</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newAction.actionClosureEffective}
                  onChange={(e) =>
                    setNewAction({ ...newAction, actionClosureEffective: e.target.checked })
                  }
                  className="rounded"
                />
                <label className="text-xs font-medium text-slate-700">
                  Action Closure Effective
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Action Closure Approved By
                </label>
                <input
                  type="text"
                  value={newAction.actionClosureApprovedBy}
                  onChange={(e) =>
                    setNewAction({ ...newAction, actionClosureApprovedBy: e.target.value })
                  }
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleAddAction}
                disabled={saving}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:bg-slate-400"
              >
                Add Action
              </button>
              <button
                onClick={() => {
                  setShowAddAction(false);
                  setNewAction(emptyForm);
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
}
