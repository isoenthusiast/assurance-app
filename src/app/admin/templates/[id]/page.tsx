'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string | null;
  controlLinkages: Array<{ controlId: string; control: { id: string; name: string } }>;
  activityTypes: Array<{ activityTypeId: string; activityType: { id: string; name: string } }>;
}

interface Control {
  id: string;
  name: string;
  processAreaId: string;
  subProcessId: string;
  processArea: { name: string };
  subProcess: { name: string };
}

interface ActivityType {
  id: string;
  name: string;
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

export default function TemplateFormPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id === 'new' ? null : (params.id as string);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');

  const [controls, setControls] = useState<Control[]>([]);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [selectedLOA, setSelectedLOA] = useState<string>('all');

  const [controlsLoading, setControlsLoading] = useState(true);
  const [processAreasLoading, setProcessAreasLoading] = useState(true);
  const [subProcessesLoading, setSubProcessesLoading] = useState(true);
  const [activityTypesLoading, setActivityTypesLoading] = useState(true);

  useEffect(() => {
    // Load controls
    const fetchControls = async () => {
      try {
        const res = await fetch('/api/admin/table/Control/data');
        if (!res.ok) throw new Error('Failed to fetch controls');
        const data = await res.json();
        setControls([...data.rows].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error loading controls:', err);
      } finally {
        setControlsLoading(false);
      }
    };

    // Load process areas
    const fetchProcessAreas = async () => {
      try {
        const res = await fetch('/api/admin/table/ProcessArea/data');
        if (!res.ok) throw new Error('Failed to fetch process areas');
        const data = await res.json();
        setProcessAreas([...data.rows].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error loading process areas:', err);
      } finally {
        setProcessAreasLoading(false);
      }
    };

    // Load sub-processes
    const fetchSubProcesses = async () => {
      try {
        const res = await fetch('/api/admin/table/SubProcess/data');
        if (!res.ok) throw new Error('Failed to fetch sub-processes');
        const data = await res.json();
        setSubProcesses([...data.rows].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error loading sub-processes:', err);
      } finally {
        setSubProcessesLoading(false);
      }
    };

    // Load activity types
    const fetchActivityTypes = async () => {
      try {
        const res = await fetch('/api/admin/table/AssuranceActivityType/data');
        if (!res.ok) throw new Error('Failed to fetch activity types');
        const data = await res.json();
        setActivityTypes([...data.rows].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Error loading activity types:', err);
      } finally {
        setActivityTypesLoading(false);
      }
    };

    fetchControls();
    fetchProcessAreas();
    fetchSubProcesses();
    fetchActivityTypes();
  }, []);

  // Load template if editing
  useEffect(() => {
    if (!templateId) return;

    const fetchTemplate = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/assessment-templates/${templateId}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        const data = await res.json();
        setTemplate(data);
        setName(data.name);
        setDescription(data.description || '');
        setSelectedControls(new Set(data.controlLinkages.map((l: any) => l.controlId)));
        setSelectedActivityType(data.activityTypes.length > 0 ? data.activityTypes[0].activityTypeId : '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId]);

  // Filter sub-processes based on selected process area
  const filteredSubProcesses = selectedProcessAreaId === 'all'
    ? subProcesses
    : subProcesses.filter((sp) => sp.processAreaId === selectedProcessAreaId);

  // Filter controls based on selected process area and sub-process
  const filteredControls = controls.filter((control) => {
    if (selectedProcessAreaId !== 'all' && control.processAreaId !== selectedProcessAreaId) {
      return false;
    }
    if (selectedSubProcessId !== 'all' && control.subProcessId !== selectedSubProcessId) {
      return false;
    }
    return true;
  });

  // Helper to get process area name
  const getProcessAreaName = (paId: string) => {
    return processAreas.find((pa) => pa.id === paId)?.name || 'Unknown';
  };

  // Helper to get sub-process name
  const getSubProcessName = (spId: string) => {
    return subProcesses.find((sp) => sp.id === spId)?.name || 'Unknown';
  };

  // Filter activity types based on selected LOA
  const filteredActivityTypes = selectedLOA === 'all'
    ? activityTypes
    : activityTypes.filter((at) => at.defaultLOA === selectedLOA);

  const toggleControl = (controlId: string) => {
    const newSelected = new Set(selectedControls);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setSelectedControls(newSelected);
  };


  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        controlIds: Array.from(selectedControls),
        activityTypeIds: selectedActivityType ? [selectedActivityType] : [],
      };

      let res;
      if (templateId) {
        res = await fetch(`/api/admin/assessment-templates/${templateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/assessment-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save template');
      }

      router.push('/admin/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center text-slate-500 py-8">Loading template...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/admin/templates" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Templates
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-8">
        {templateId ? '✏️ Edit Template' : '➕ Create Template'}
      </h1>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="space-y-6 bg-white p-6 rounded border border-slate-200">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Template Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Annual Process Safety Review"
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is used for..."
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        {/* Controls Filters */}
        {!processAreasLoading && !subProcessesLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filter by Process Area
              </label>
              <select
                value={selectedProcessAreaId}
                onChange={(e) => {
                  setSelectedProcessAreaId(e.target.value);
                  setSelectedSubProcessId('all'); // Reset sub-process filter
                }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="all">All Process Areas ({processAreas.length})</option>
                {processAreas.map((pa) => (
                  <option key={pa.id} value={pa.id}>
                    {pa.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filter by Sub-Process
              </label>
              <select
                value={selectedSubProcessId}
                onChange={(e) => setSelectedSubProcessId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                disabled={selectedProcessAreaId === 'all'}
              >
                <option value="all">All Sub-Processes ({filteredSubProcesses.length})</option>
                {filteredSubProcesses.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Controls Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            {controlsLoading
              ? 'Loading Controls...'
              : `Controls (${selectedControls.size} selected of ${filteredControls.length} displayed)`}
          </label>
          {!controlsLoading && (
            <>
              {filteredControls.length === 0 ? (
                <div className="border border-slate-200 rounded p-4 text-center text-slate-500">
                  <p className="text-sm">
                    {selectedProcessAreaId !== 'all' || selectedSubProcessId !== 'all'
                      ? 'No controls found for the selected filters'
                      : 'No controls available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded p-3">
                  {filteredControls.map((control) => (
                    <label key={control.id} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedControls.has(control.id)}
                        onChange={() => toggleControl(control.id)}
                        className="h-4 w-4 rounded border-slate-300 mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 text-sm">
                        <div className="text-slate-900 font-medium">{control.name}</div>
                        <div className="text-slate-500 text-xs">
                          {getProcessAreaName(control.processAreaId)} / {getSubProcessName(control.subProcessId)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity Types Filter */}
        {!activityTypesLoading && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Line of Assurance
            </label>
            <select
              value={selectedLOA}
              onChange={(e) => setSelectedLOA(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Lines of Assurance ({activityTypes.length})</option>
              <option value="FirstLine">First Line Assurance ({activityTypes.filter((a) => a.defaultLOA === 'FirstLine').length})</option>
              <option value="SecondLine">Second Line Assurance ({activityTypes.filter((a) => a.defaultLOA === 'SecondLine').length})</option>
              <option value="ThirdLine">Third Line Assurance ({activityTypes.filter((a) => a.defaultLOA === 'ThirdLine').length})</option>
            </select>
          </div>
        )}

        {/* Activity Types Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            {activityTypesLoading ? 'Loading Activity Types...' : `Activity Types (${selectedActivityType ? '1 selected' : 'none selected'} of ${filteredActivityTypes.length} displayed)`}
          </label>
          {!activityTypesLoading && (
            <>
              {filteredActivityTypes.length === 0 ? (
                <div className="border border-slate-200 rounded p-4 text-center text-slate-500">
                  <p className="text-sm">No activity types available for the selected line of assurance</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded p-3">
                  {filteredActivityTypes.map((type) => (
                    <label key={type.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="radio"
                        name="activityType"
                        value={type.id}
                        checked={selectedActivityType === type.id}
                        onChange={(e) => setSelectedActivityType(e.target.value)}
                        className="h-4 w-4 border-slate-300"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-slate-700 font-medium">{type.name}</span>
                        {type.description && (
                          <div className="text-xs text-slate-500">{type.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '⏳ Saving...' : '✓ Save Template'}
          </button>
          <Link
            href="/admin/templates"
            className="rounded border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
