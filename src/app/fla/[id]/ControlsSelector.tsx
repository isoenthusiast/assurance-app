'use client';

import { useState, useEffect } from 'react';

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
  processArea?: { name: string };
  subProcess?: { name: string };
  controlSubProcesses?: { subProcess?: { id: string; name: string }; subProcessId?: string }[];
}

interface ControlsSelectorProps {
  selectedControlIds: string[];
  onSelectionChange?: (controlIds: string[]) => Promise<void> | void;
}

export default function ControlsSelector({
  selectedControlIds,
  onSelectionChange,
}: ControlsSelectorProps) {
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [allControls, setAllControls] = useState<Control[]>([]);

  const [selectedPA, setSelectedPA] = useState('');
  const [selectedSP, setSelectedSP] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedControlIds));

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/controls');

        if (res.ok) {
          const data = await res.json();
          setProcessAreas([...(data.processAreas || [])].sort((a, b) => a.name.localeCompare(b.name)));
          setSubProcesses([...(data.subProcesses || [])].sort((a, b) => a.name.localeCompare(b.name)));
          setAllControls(data.controls || []);
        }
      } catch (err) {
        console.error('Failed to load filter data:', err);
      }
    };

    fetchData();
  }, []);

  // Filter subprocesses based on selected PA
  const filteredSubProcesses = selectedPA
    ? subProcesses.filter((sp) => sp.processAreaId === selectedPA)
    : [];

  // Filter controls based on PA, SP, and search
  const filteredControls = allControls.filter((control) => {
    if (selectedPA && control.processAreaId !== selectedPA) return false;
    if (selectedSP) {
      const linkedIds = (control.controlSubProcesses || []).map((csp: any) => csp.subProcess?.id || csp.subProcessId);
      if (!linkedIds.includes(selectedSP)) return false;
    }
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const nameMatch = control.name.toLowerCase().includes(searchLower);
      const statementMatch = control.statement.toLowerCase().includes(searchLower);
      return nameMatch || statementMatch;
    }
    return true;
  });

  const handleToggleControl = (controlId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleSelectAll = () => {
    const newSelected = new Set(selectedIds);
    filteredControls.forEach((c) => newSelected.add(c.id));
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const handleDeselectAll = () => {
    const newSelected = new Set(selectedIds);
    filteredControls.forEach((c) => newSelected.delete(c.id));
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  return (
    <div className="space-y-4 border border-slate-200 rounded p-4 bg-slate-50">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Process Area
          </label>
          <select
            value={selectedPA}
            onChange={(e) => {
              setSelectedPA(e.target.value);
              setSelectedSP('');
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Process Areas</option>
            {processAreas.map((pa) => (
              <option key={pa.id} value={pa.id}>
                {pa.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Sub-Process
          </label>
          <select
            value={selectedSP}
            onChange={(e) => setSelectedSP(e.target.value)}
            disabled={!selectedPA}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="">All Sub-Processes</option>
            {filteredSubProcesses.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Search Controls (wildcard: use * for any characters)
          </label>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="e.g., *test* or audit*"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Select All / Deselect All */}
      {filteredControls.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            ☑ Select All ({filteredControls.length})
          </button>
          <button
            onClick={handleDeselectAll}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            ☐ Deselect All
          </button>
          <span className="text-xs text-slate-600 ml-auto">
            Selected: {selectedIds.size} / {allControls.length}
          </span>
        </div>
      )}

      {/* Controls Checkboxes */}
      <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded p-3 bg-white">
        {filteredControls.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-8">
            No controls match the selected filters
          </div>
        ) : (
          filteredControls.map((control) => (
            <div key={control.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`control-${control.id}`}
                checked={selectedIds.has(control.id)}
                onChange={() => handleToggleControl(control.id)}
                className="rounded mt-1"
              />
              <label
                htmlFor={`control-${control.id}`}
                className="flex-1 text-xs cursor-pointer"
              >
                <div className="font-medium text-slate-900">{control.name}</div>
                <div className="text-slate-600 text-xs">
                  {control.processArea?.name || processAreas.find(pa => pa.id === control.processAreaId)?.name || 'Unknown'} / {(control.controlSubProcesses && control.controlSubProcesses[0]?.subProcess?.name) || '—'}
                </div>
                <div className="text-slate-500 text-xs mt-1 line-clamp-2">
                  {control.statement}
                </div>
              </label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
