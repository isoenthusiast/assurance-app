'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Template {
  id: string;
  name: string;
  description: string | null;
  controlLinkages: Array<{
    id: string;
    control: { id: string; name: string; statement: string; processAreaId: string };
  }>;
  activityTypes: Array<{
    id: string;
    activityType: { id: string; name: string };
  }>;
}

interface ProcessArea {
  id: string;
  name: string;
}

interface SubProcess {
  id: string;
  name: string;
  processAreaId: string;
}

export default function PlanAssessmentFromTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [assessmentName, setAssessmentName] = useState<string>('');
  const [assessmentDate, setAssessmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch template
        const templateRes = await fetch(`/api/admin/assessment-templates/${templateId}`);
        if (!templateRes.ok) throw new Error('Failed to fetch template');
        const templateData = await templateRes.json();
        setTemplate(templateData);
        setAssessmentName(`${templateData.name} - ${new Date().toLocaleDateString()}`);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [templateId]);

  const availableSubProcesses = useMemo(() => {
    if (selectedProcessAreaId === 'all') return subProcesses;
    return subProcesses.filter((sp) => sp.processAreaId === selectedProcessAreaId);
  }, [selectedProcessAreaId, subProcesses]);

  const filteredControls = useMemo(() => {
    if (!template) return [];

    return template.controlLinkages.filter((link) => {
      const matchPA =
        selectedProcessAreaId === 'all' ||
        link.control.processAreaId === selectedProcessAreaId;
      const matchSP =
        selectedSubProcessId === 'all' ||
        link.control.processAreaId === selectedProcessAreaId; // Note: controls don't have subProcessId in our response
      return matchPA && matchSP;
    });
  }, [template, selectedProcessAreaId, selectedSubProcessId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assessmentName.trim()) {
      setError('Assessment name is required');
      return;
    }

    if (!template?.activityTypes[0]) {
      setError('Template must have an activity type');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Get the controls that are currently visible (filtered)
      const controlIds = filteredControls.map((link) => link.control.id);

      if (controlIds.length === 0) {
        setError('Please select at least one control by adjusting filters');
        return;
      }

      const res = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assessmentName,
          activityTypeId: template.activityTypes[0].activityType.id,
          startDate: new Date(assessmentDate).toISOString(),
          controlIds,
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
        <div className="text-center text-slate-500">Loading template...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          Template not found
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin/templates" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Templates
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">📋 Plan Assessment from Template</h1>
        <p className="mt-1 text-slate-600">Create a new assessment using "{template.name}"</p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Assessment Details */}
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
              Activity Type (from template)
            </label>
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-slate-600">
              {template.activityTypes[0]?.activityType.name || 'None'}
            </div>
          </div>
        </div>

        {/* Control Filters */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Filter Controls</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>

        {/* Controls Summary */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Controls ({filteredControls.length} of {template.controlLinkages.length})
          </h2>

          {filteredControls.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              ⚠️ No controls match your filters. Adjust filters to select controls.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredControls.map((link) => (
                <div
                  key={link.id}
                  className="rounded border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <div className="font-medium text-slate-900">{link.control.name}</div>
                  <div className="text-xs text-slate-600 mt-1">{link.control.statement}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={creating || filteredControls.length === 0}
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {creating ? '⏳ Creating...' : '✓ Create Assessment'}
          </button>
          <Link
            href="/admin/templates"
            className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
