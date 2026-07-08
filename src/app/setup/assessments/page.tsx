'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Control {
  id: string;
  name: string;
  statement: string;
  processAreaId: string;
}

interface ControlAssignment {
  id: string;
  control: Control;
}

interface Assessment {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  controlAssignments: ControlAssignment[];
  activityType: { name: string };
  assessor: { name: string };
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

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [controlDescriptionFilter, setControlDescriptionFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch assessments
        const assessRes = await fetch('/api/admin/assessments');
        if (!assessRes.ok) throw new Error('Failed to fetch assessments');
        const assessData = await assessRes.json();
        setAssessments(assessData);

        // Fetch process areas and sub-processes via public endpoint
        const controlsRes = await fetch('/api/controls');
        if (controlsRes.ok) {
          const controlsData = await controlsRes.json();
          setProcessAreas(controlsData.processAreas || []);
          // Deduplicate sub-processes by ID (CSV imports can create duplicates)
          const seen = new Set<string>();
          setSubProcesses((controlsData.subProcesses || []).filter((sp: SubProcess) => {
            if (seen.has(sp.id)) return false;
            seen.add(sp.id);
            return true;
          }));
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

  // Count assessments per process area
  const paAssessmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assessments) {
      const seen = new Set<string>();
      for (const ca of a.controlAssignments) {
        if (ca.control.processAreaId && !seen.has(ca.control.processAreaId)) {
          seen.add(ca.control.processAreaId);
          counts[ca.control.processAreaId] = (counts[ca.control.processAreaId] || 0) + 1;
        }
      }
    }
    return counts;
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      if (selectedProcessAreaId !== 'all') {
        if (!assessment.controlAssignments.some(ca => ca.control.processAreaId === selectedProcessAreaId)) return false;
      }
      if (selectedSubProcessId !== 'all') {
        const matchingPA = subProcesses.find(sp => sp.id === selectedSubProcessId);
        if (matchingPA && !assessment.controlAssignments.some(ca => ca.control.processAreaId === matchingPA.processAreaId)) return false;
      }
      if (controlDescriptionFilter.trim()) {
        const term = controlDescriptionFilter.toLowerCase();
        if (!assessment.controlAssignments.some(ca => ca.control.name.toLowerCase().includes(term) || ca.control.statement.toLowerCase().includes(term))) return false;
      }
      return true;
    });
  }, [assessments, selectedProcessAreaId, selectedSubProcessId, controlDescriptionFilter, subProcesses]);

  const totalPages = Math.ceil(filteredAssessments.length / itemsPerPage);
  const paginatedAssessments = filteredAssessments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(paginatedAssessments.map(a => a.id)) : new Set());
  };

  const handleSelectAssessment = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    checked ? next.add(id) : next.delete(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} assessment(s)?`)) return;
    try {
      for (const id of selectedIds) await fetch(`/api/admin/assessments/${id}`, { method: 'DELETE' });
      setAssessments(assessments.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const updatePage = (p: number) => { setCurrentPage(p); setPageInput(String(p)); };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📊 Assessments</h1>
          <p className="mt-1 text-slate-600">View and manage assessment plans</p>
        </div>
        <Link href="/setup/assessments/new" className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors">
          ➕ Plan Assessment
        </Link>
      </div>

      {error && <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">❌ {error}</div>}

      {/* Filters */}
      <div className="mb-6 rounded border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Process Area</label>
            <select value={selectedProcessAreaId} onChange={e => { setSelectedProcessAreaId(e.target.value); setSelectedSubProcessId('all'); setCurrentPage(1); }} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All Process Areas ({assessments.length})</option>
              {processAreas.filter(pa => paAssessmentCounts[pa.id]).map(pa => <option key={pa.id} value={pa.id}>{pa.name} ({paAssessmentCounts[pa.id]})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Process</label>
            <select value={selectedSubProcessId} onChange={e => { setSelectedSubProcessId(e.target.value); setCurrentPage(1); }} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All Sub-Processes ({availableSubProcesses.length})</option>
              {availableSubProcesses.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Control Description</label>
            <input value={controlDescriptionFilter} onChange={e => { setControlDescriptionFilter(e.target.value); setCurrentPage(1); }} placeholder="Search controls..." className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading assessments...</div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">{filteredAssessments.length} assessment(s)</span>
            {selectedIds.size > 0 && (
              <button onClick={handleDeleteSelected} className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50">Delete Selected ({selectedIds.size})</button>
            )}
          </div>

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={paginatedAssessments.length > 0 && selectedIds.size === paginatedAssessments.length} /></th>
                  <th className="px-3 py-2 font-medium text-slate-700">Name</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Activity Type</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Status</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Controls</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Assessor</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Period</th>
                  <th className="px-3 py-2 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssessments.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(a.id)} onChange={e => handleSelectAssessment(a.id, e.target.checked)} /></td>
                    <td className="px-3 py-2 font-medium text-slate-900"><Link href={`/fla/${a.id}`} className="hover:underline">{a.name}</Link></td>
                    <td className="px-3 py-2 text-slate-600">{a.activityType?.name}</td>
                    <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'Completed' ? 'bg-green-100 text-green-700' : a.status === 'InProgress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{a.status}</span></td>
                    <td className="px-3 py-2 text-slate-600">{a.controlAssignments?.length || 0}</td>
                    <td className="px-3 py-2 text-slate-600">{a.assessor?.name}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{a.startDate ? new Date(a.startDate).toLocaleDateString() : '—'} – {a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/fla/${a.id}`} className="text-xs text-blue-600 hover:underline mr-2">View</Link>
                      <Link href={`/fla/${a.id}`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                    </td>
                  </tr>
                ))}
                {paginatedAssessments.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">No assessments found</td></tr>}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>Page {currentPage} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => updatePage(1)} disabled={currentPage === 1} className="rounded border px-2 py-0.5 disabled:opacity-30">First</button>
                <button onClick={() => updatePage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded border px-2 py-0.5 disabled:opacity-30">Prev</button>
                <input value={pageInput} onChange={e => setPageInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && updatePage(parseInt(pageInput) || 1)} className="w-10 rounded border px-1 text-center" />
                <button onClick={() => updatePage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="rounded border px-2 py-0.5 disabled:opacity-30">Next</button>
                <button onClick={() => updatePage(totalPages)} disabled={currentPage === totalPages} className="rounded border px-2 py-0.5 disabled:opacity-30">Last</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
