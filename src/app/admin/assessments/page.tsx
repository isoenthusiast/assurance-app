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
  }, []);

  const availableSubProcesses = useMemo(() => {
    if (selectedProcessAreaId === 'all') return subProcesses;
    return subProcesses.filter((sp) => sp.processAreaId === selectedProcessAreaId);
  }, [selectedProcessAreaId, subProcesses]);

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((assessment) => {
      // Filter by process area
      if (selectedProcessAreaId !== 'all') {
        const hasControl = assessment.controlAssignments.some(
          (ca) => ca.control.processAreaId === selectedProcessAreaId
        );
        if (!hasControl) return false;
      }

      // Filter by sub-process (check against process area)
      if (selectedSubProcessId !== 'all') {
        const matchingPA = subProcesses.find((sp) => sp.id === selectedSubProcessId);
        if (matchingPA) {
          const hasControl = assessment.controlAssignments.some(
            (ca) => ca.control.processAreaId === matchingPA.processAreaId
          );
          if (!hasControl) return false;
        }
      }

      // Filter by control description (wildcard)
      if (controlDescriptionFilter.trim()) {
        const searchTerm = controlDescriptionFilter.toLowerCase();
        const hasMatch = assessment.controlAssignments.some((ca) =>
          ca.control.name.toLowerCase().includes(searchTerm) ||
          ca.control.statement.toLowerCase().includes(searchTerm)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [assessments, selectedProcessAreaId, selectedSubProcessId, controlDescriptionFilter, subProcesses]);

  // Pagination
  const totalPages = Math.ceil(filteredAssessments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssessments = filteredAssessments.slice(startIndex, endIndex);

  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const updatePageInput = (newPage: number) => {
    setCurrentPage(newPage);
    setPageInput(String(newPage));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedAssessments.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectAssessment = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} assessment(s)? This cannot be undone.`)) return;

    try {
      for (const id of selectedIds) {
        await fetch(`/api/admin/assessments/${id}`, { method: 'DELETE' });
      }
      setAssessments(assessments.filter((a) => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assessments');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📊 Planned Assessments</h1>
          <p className="mt-1 text-slate-600">View and manage assessment plans</p>
        </div>
        <Link
          href="/admin/templates"
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
        >
          ➕ Plan Assessment
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Process Area</label>
            <select
              value={selectedProcessAreaId}
              onChange={(e) => {
                setSelectedProcessAreaId(e.target.value);
                setSelectedSubProcessId('all');
                setCurrentPage(1);
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Process</label>
            <select
              value={selectedSubProcessId}
              onChange={(e) => {
                setSelectedSubProcessId(e.target.value);
                setCurrentPage(1);
              }}
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Control Description (wildcard)
            </label>
            <input
              type="text"
              value={controlDescriptionFilter}
              onChange={(e) => {
                setControlDescriptionFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search controls..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Loading assessments...</div>
      ) : assessments.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600 mb-4">No assessments yet</p>
          <Link
            href="/admin/templates"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Plan your first assessment
          </Link>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600">No assessments match your filters</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="mb-6 overflow-hidden rounded border border-slate-200 bg-white">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedAssessments.length && paginatedAssessments.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Assessment Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Activity Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Controls
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Assessor
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                    Start Date
                  </th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssessments.map((assessment) => (
                  <tr key={assessment.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(assessment.id)}
                        onChange={(e) => handleSelectAssessment(assessment.id, e.target.checked)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {assessment.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {assessment.activityType.name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                        assessment.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : assessment.status === 'InProgress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {assessment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {assessment.controlAssignments.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {assessment.assessor.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(assessment.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/assessments/${assessment.id}`}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="rounded border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm text-slate-600">
                Showing <strong>{startIndex + 1}</strong> to{' '}
                <strong>{Math.min(endIndex, filteredAssessments.length)}</strong> of{' '}
                <strong>{filteredAssessments.length}</strong> assessments
              </div>

              <div className="w-40">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Items Per Page
                </label>
                <select
                  value={itemsPerPage === filteredAssessments.length ? 'all' : itemsPerPage}
                  onChange={(e) => {
                    const value = e.target.value === 'all' ? filteredAssessments.length : Number(e.target.value);
                    setItemsPerPage(value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                >
                  <option value={5}>5 items</option>
                  <option value={10}>10 items</option>
                  <option value={30}>30 items</option>
                  <option value={100}>100 items</option>
                  <option value="all">All items</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updatePageInput(1)}
                disabled={currentPage === 1}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              >
                ⇤ First
              </button>

              <button
                onClick={() => updatePageInput(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-600">Page</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => handlePageInputChange(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handlePageInputSubmit()}
                  onBlur={handlePageInputSubmit}
                  className="w-16 rounded border border-slate-300 px-2 py-2 text-sm text-center font-medium"
                />
                <span className="text-sm text-slate-600">of {totalPages}</span>
              </div>

              <button
                onClick={() => updatePageInput(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Next →
              </button>

              <button
                onClick={() => updatePageInput(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              >
                Last ⇥
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <span className="text-sm text-amber-800">
                {selectedIds.size} assessment(s) selected
              </span>
              <button
                onClick={handleDeleteSelected}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 transition-colors"
              >
                🗑️ Delete Selected
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
