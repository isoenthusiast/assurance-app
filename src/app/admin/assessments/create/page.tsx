'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProcessArea {
  id: string;
  name: string;
}

interface SubProcess {
  id: string;
  name: string;
  processAreaId: string;
}

interface Control {
  id: string;
  name: string;
  statement: string;
  processAreaId: string;
}

interface ActivityType {
  id: string;
  name: string;
  defaultLOA: string;
}

export default function CreateAssessmentPage() {
  const router = useRouter();

  const [assessmentName, setAssessmentName] = useState<string>('');
  const [assessmentDate, setAssessmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedActivityTypeId, setSelectedActivityTypeId] = useState<string>('');
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());

  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch process areas
        const areasRes = await fetch('/api/admin/table/ProcessArea/data');
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          if (areasData.rows) {
            setProcessAreas([...areasData.rows].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Fetch sub-processes
        const subRes = await fetch('/api/admin/table/SubProcess/data');
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.rows) {
            setSubProcesses([...subData.rows].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Fetch controls
        const ctrlRes = await fetch('/api/admin/table/Control/data');
        if (ctrlRes.ok) {
          const ctrlData = await ctrlRes.json();
          if (ctrlData.rows) {
            setControls([...ctrlData.rows].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Fetch activity types
        const actRes = await fetch('/api/admin/table/AssuranceActivityType/data');
        if (actRes.ok) {
          const actData = await actRes.json();
          if (actData.rows) {
            setActivityTypes([...actData.rows].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const availableSubProcesses = useMemo(() => {
    if (selectedProcessAreaId === 'all') return subProcesses;
    return subProcesses.filter((sp) => sp.processAreaId === selectedProcessAreaId);
  }, [selectedProcessAreaId, subProcesses]);

  const filteredControls = useMemo(() => {
    return controls.filter((control) => {
      const matchPA =
        selectedProcessAreaId === 'all' ||
        control.processAreaId === selectedProcessAreaId;
      return matchPA;
    });
  }, [controls, selectedProcessAreaId]);

  const handleToggleControl = (controlId: string) => {
    const newSelected = new Set(selectedControlIds);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setSelectedControlIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedControlIds(new Set(filteredControls.map((c) => c.id)));
    } else {
      setSelectedControlIds(new Set());
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assessmentName.trim()) {
      setError('Assessment name is required');
      return;
    }

    if (!selectedActivityTypeId) {
      setError('Activity type is required');
      return;
    }

    if (selectedControlIds.size === 0) {
      setError('At least one control must be selected');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const res = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assessmentName,
          activityTypeId: selectedActivityTypeId,
          startDate: new Date(assessmentDate).toISOString(),
          controlIds: Array.from(selectedControlIds),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create assessment');
      }

      const newAssessment = await res.json();
      router.push(`/admin/assessments/${newAssessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="text-center text-slate-500">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/fla"
        className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline"
      >
        ← Back to FLA Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">✨ Create Assessment from Scratch</h1>
        <p className="mt-1 text-slate-600">Build a custom assessment with full control</p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Assessment Details</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Assessment Name *
              </label>
              <input
                type="text"
                value={assessmentName}
                onChange={(e) => setAssessmentName(e.target.value)}
                placeholder="e.g., Q1 2026 FLA Review"
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={assessmentDate}
                onChange={(e) => setAssessmentDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Activity Type *
            </label>
            <select
              value={selectedActivityTypeId}
              onChange={(e) => setSelectedActivityTypeId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
              required
            >
              <option value="">Select an activity type...</option>
              {activityTypes.map((at) => (
                <option key={at.id} value={at.id}>
                  {at.name} (LOA: {at.defaultLOA})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Control Selection */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Controls</h2>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Process Area
              </label>
              <select
                value={selectedProcessAreaId}
                onChange={(e) => {
                  setSelectedProcessAreaId(e.target.value);
                  setSelectedSubProcessId('all');
                }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
              >
                <option value="all">All Process Areas</option>
                {processAreas.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sub-Process
              </label>
              <select
                value={selectedSubProcessId}
                onChange={(e) => setSelectedSubProcessId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
              >
                <option value="all">All Sub-Processes</option>
                {availableSubProcesses.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Control List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">
                Available Controls ({filteredControls.length})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    selectedControlIds.size === filteredControls.length &&
                    filteredControls.length > 0
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
                <span>Select All</span>
              </label>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded p-4 bg-slate-50">
              {filteredControls.length === 0 ? (
                <p className="text-sm text-slate-500">No controls found for selected filters</p>
              ) : (
                filteredControls.map((control) => (
                  <label
                    key={control.id}
                    className="flex items-start gap-3 p-3 rounded bg-white border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedControlIds.has(control.id)}
                      onChange={() => handleToggleControl(control.id)}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{control.name}</div>
                      <div className="text-xs text-slate-600 mt-1">{control.statement}</div>
                    </div>
                  </label>
                ))
              )}
            </div>

            {filteredControls.length > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                {selectedControlIds.size} of {filteredControls.length} selected
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={creating || selectedControlIds.size === 0}
            className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {creating ? '⏳ Creating...' : '✓ Create Assessment'}
          </button>
          <Link
            href="/fla"
            className="rounded border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
