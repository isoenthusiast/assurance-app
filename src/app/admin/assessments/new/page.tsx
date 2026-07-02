'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Template {
  id: string;
  name: string;
  description: string | null;
  controlLinkages: Array<{ id: string; control: { id: string; name: string; statement: string; processAreaId: string } }>;
  activityTypes: Array<{ id: string; activityType: { name: string; id: string } }>;
  createdAt: string;
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

export default function PlanAssessmentPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'template' | 'blank'>('template');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [controlFilter, setControlFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [creating, setCreating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Blank (no-template) form state
  const [blankName, setBlankName] = useState<string>('');
  const [blankDate, setBlankDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [blankActivityTypeId, setBlankActivityTypeId] = useState<string>('');
  const [blankProcessAreaId, setBlankProcessAreaId] = useState<string>('all');
  const [blankSubProcessId, setBlankSubProcessId] = useState<string>('all');
  const [blankControlIds, setBlankControlIds] = useState<Set<string>>(new Set());
  const [creatingBlank, setCreatingBlank] = useState(false);
  const [blankError, setBlankError] = useState<string | null>(null);

  const itemsPerPage = 5;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch templates
        const templatesRes = await fetch('/api/admin/assessment-templates');
        if (!templatesRes.ok) throw new Error('Failed to fetch templates');
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);

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

        // Fetch controls (needed for the "no template" entry form)
        const ctrlRes = await fetch('/api/admin/table/Control/data');
        if (ctrlRes.ok) {
          const ctrlData = await ctrlRes.json();
          if (ctrlData.rows) {
            setControls([...ctrlData.rows].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Fetch activity types (needed for the "no template" entry form)
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

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Filter by process area
      if (selectedProcessAreaId !== 'all') {
        const hasControl = template.controlLinkages.some(
          (l) => l.control.processAreaId === selectedProcessAreaId
        );
        if (!hasControl) return false;
      }

      // Filter by sub-process (check against process area)
      if (selectedSubProcessId !== 'all') {
        const matchingSP = subProcesses.find((sp) => sp.id === selectedSubProcessId);
        if (matchingSP) {
          const hasControl = template.controlLinkages.some(
            (l) => l.control.processAreaId === matchingSP.processAreaId
          );
          if (!hasControl) return false;
        }
      }

      // Filter by control statement (wildcard)
      if (controlFilter.trim()) {
        const searchTerm = controlFilter.toLowerCase();
        const hasMatch = template.controlLinkages.some((l) =>
          l.control.statement.toLowerCase().includes(searchTerm)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [templates, selectedProcessAreaId, selectedSubProcessId, controlFilter, subProcesses]);

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + itemsPerPage);

  const handlePlanAssessment = async (templateId: string, templateName: string) => {
    try {
      setCreating(templateId);
      setError(null);

      const template = templates.find((t) => t.id === templateId);
      if (!template || !template.activityTypes[0]) {
        throw new Error('Template data invalid');
      }

      const res = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${templateName} - ${new Date().toLocaleDateString()}`,
          activityTypeId: template.activityTypes[0].activityType.id,
          startDate: new Date().toISOString(),
          controlIds: template.controlLinkages.map((l) => l.control.id),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create assessment');
      }

      const newAssessment = await res.json();
      router.push(`/fla/${newAssessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assessment');
      setCreating(null);
    }
  };

  // ---- Blank (no template) entry form logic ----

  const blankAvailableSubProcesses = useMemo(() => {
    if (blankProcessAreaId === 'all') return subProcesses;
    return subProcesses.filter((sp) => sp.processAreaId === blankProcessAreaId);
  }, [blankProcessAreaId, subProcesses]);

  const blankFilteredControls = useMemo(() => {
    return controls.filter((control) => {
      const matchPA = blankProcessAreaId === 'all' || control.processAreaId === blankProcessAreaId;
      return matchPA;
    });
  }, [controls, blankProcessAreaId]);

  const handleToggleBlankControl = (controlId: string) => {
    const newSelected = new Set(blankControlIds);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setBlankControlIds(newSelected);
  };

  const handleSelectAllBlank = (checked: boolean) => {
    if (checked) {
      setBlankControlIds(new Set(blankFilteredControls.map((c) => c.id)));
    } else {
      setBlankControlIds(new Set());
    }
  };

  const handleCreateBlank = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!blankName.trim()) {
      setBlankError('Assessment name is required');
      return;
    }
    if (!blankActivityTypeId) {
      setBlankError('Activity type is required');
      return;
    }
    if (blankControlIds.size === 0) {
      setBlankError('At least one control must be selected');
      return;
    }

    try {
      setCreatingBlank(true);
      setBlankError(null);

      const res = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: blankName,
          activityTypeId: blankActivityTypeId,
          startDate: new Date(blankDate).toISOString(),
          controlIds: Array.from(blankControlIds),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create assessment');
      }

      const newAssessment = await res.json();
      router.push(`/fla/${newAssessment.id}`);
    } catch (err) {
      setBlankError(err instanceof Error ? err.message : 'Failed to create assessment');
    } finally {
      setCreatingBlank(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/fla" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
          ← Back to FLA Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">📋 Plan Assessment</h1>
        <div className="mt-6 text-center text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/fla" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to FLA Dashboard
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">📋 Plan Assessment</h1>

        <div className="flex rounded border border-slate-300 overflow-hidden text-sm">
          <button
            onClick={() => setMode('template')}
            className={`px-4 py-2 font-medium transition-colors ${
              mode === 'template' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            From a Template
          </button>
          <button
            onClick={() => setMode('blank')}
            className={`px-4 py-2 font-medium transition-colors border-l border-slate-300 ${
              mode === 'blank' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ＋ No Template
          </button>
        </div>
      </div>

      {mode === 'template' ? (
        <>
          {error && (
            <div className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              ❌ {error}
            </div>
          )}

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Process Area</label>
              <select
                value={selectedProcessAreaId}
                onChange={(e) => {
                  setSelectedProcessAreaId(e.target.value);
                  setSelectedSubProcessId('all');
                  setCurrentPage(1);
                }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="all">All</option>
                {processAreas.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Sub-Process</label>
              <select
                value={selectedSubProcessId}
                onChange={(e) => {
                  setSelectedSubProcessId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="all">All</option>
                {availableSubProcesses.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Control Statement</label>
              <input
                type="text"
                value={controlFilter}
                onChange={(e) => {
                  setControlFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search..."
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Templates Table */}
          {filteredTemplates.length === 0 ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
              <p>No templates match your filters.</p>
              <button
                onClick={() => setMode('blank')}
                className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 transition-colors font-medium"
              >
                ＋ Create an Assessment Without a Template
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded border border-slate-200">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Template</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Controls</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-700">Activity Type</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTemplates.map((template) => (
                      <tr key={template.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-slate-600">{template.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {template.controlLinkages.length}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {template.activityTypes[0]?.activityType.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handlePlanAssessment(template.id, template.name)}
                            disabled={creating === template.id}
                            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {creating === template.id ? '⏳' : '+'} Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <div>
                    Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredTemplates.length)} of{' '}
                    {filteredTemplates.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            currentPage === page
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* No-template entry form */}
          <p className="mb-6 text-sm text-slate-600">
            Build a one-off assessment without starting from a template.
          </p>

          {blankError && (
            <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              ❌ {blankError}
            </div>
          )}

          <form onSubmit={handleCreateBlank} className="space-y-6">
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
                    value={blankName}
                    onChange={(e) => setBlankName(e.target.value)}
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
                    value={blankDate}
                    onChange={(e) => setBlankDate(e.target.value)}
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
                  value={blankActivityTypeId}
                  onChange={(e) => setBlankActivityTypeId(e.target.value)}
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
                    value={blankProcessAreaId}
                    onChange={(e) => {
                      setBlankProcessAreaId(e.target.value);
                      setBlankSubProcessId('all');
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
                    value={blankSubProcessId}
                    onChange={(e) => setBlankSubProcessId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
                  >
                    <option value="all">All Sub-Processes</option>
                    {blankAvailableSubProcesses.map((sp) => (
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
                    Available Controls ({blankFilteredControls.length})
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        blankControlIds.size === blankFilteredControls.length &&
                        blankFilteredControls.length > 0
                      }
                      onChange={(e) => handleSelectAllBlank(e.target.checked)}
                      className="rounded"
                    />
                    <span>Select All</span>
                  </label>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded p-4 bg-slate-50">
                  {blankFilteredControls.length === 0 ? (
                    <p className="text-sm text-slate-500">No controls found for selected filters</p>
                  ) : (
                    blankFilteredControls.map((control) => (
                      <label
                        key={control.id}
                        className="flex items-start gap-3 p-3 rounded bg-white border border-slate-200 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={blankControlIds.has(control.id)}
                          onChange={() => handleToggleBlankControl(control.id)}
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

                {blankFilteredControls.length > 0 && (
                  <p className="mt-3 text-sm text-slate-600">
                    {blankControlIds.size} of {blankFilteredControls.length} selected
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creatingBlank || blankControlIds.size === 0}
                className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {creatingBlank ? '⏳ Creating...' : '✓ Create Assessment'}
              </button>
              <button
                type="button"
                onClick={() => setMode('template')}
                className="rounded border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
