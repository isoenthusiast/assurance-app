'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { deleteControl } from './actions';
import DeleteButton from '@/components/DeleteButton';

type Control = {
  id: string;
  name: string;
  statement: string;
  controlType: string;
  isHsseCritical: boolean;
  ramRating: string | null;
  processArea: { name: string };
  subProcess: { name: string };
  _count: { controlAssignments: number };
};

type ProcessArea = { id: string; name: string };
type SubProcess = { id: string; name: string; processAreaId: string };

export default function ControlsTable({
  controls,
  processAreas,
  subProcesses,
}: {
  controls: Control[];
  processAreas: ProcessArea[];
  subProcesses: SubProcess[];
}) {
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Get filtered subprocesses based on selected process area
  const availableSubProcesses = useMemo(() => {
    if (selectedProcessAreaId === 'all') {
      return subProcesses;
    }
    return subProcesses.filter((sp) => sp.processAreaId === selectedProcessAreaId);
  }, [selectedProcessAreaId, subProcesses]);

  // Reset sub-process filter when process area changes
  const handleProcessAreaChange = (value: string) => {
    setSelectedProcessAreaId(value);
    setSelectedSubProcessId('all');
    setCurrentPage(1);
    setPageInput('1');
  };

  // Handle page input change
  const handlePageInputChange = (value: string) => {
    setPageInput(value);
  };

  // Handle page input submission
  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Update page input when current page changes
  const updatePageInput = (newPage: number) => {
    setCurrentPage(newPage);
    setPageInput(String(newPage));
  };

  // Filter controls
  const filteredControls = useMemo(() => {
    return controls.filter((control) => {
      const matchProcessArea =
        selectedProcessAreaId === 'all' || control.processArea.name === processAreas.find((pa) => pa.id === selectedProcessAreaId)?.name;

      const matchSubProcess =
        selectedSubProcessId === 'all' || control.subProcess.id === selectedSubProcessId;

      return matchProcessArea && matchSubProcess;
    });
  }, [controls, selectedProcessAreaId, selectedSubProcessId, processAreas]);

  // Pagination
  const totalPages = Math.ceil(filteredControls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedControls = filteredControls.slice(startIndex, endIndex);

  return (
    <div className="mt-6 space-y-4">
      {/* Filters */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Process Area</label>
            <select
              value={selectedProcessAreaId}
              onChange={(e) => handleProcessAreaChange(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
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
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
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

      {/* Table */}
      <table className="w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2">Process Area / Sub-Process</th>
            <th className="px-4 py-2">Control</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">HSSE</th>
            <th className="px-4 py-2">Assigned Assessments</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {paginatedControls.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-2 text-slate-600">
                {c.processArea.name} / {c.subProcess.name}
              </td>
              <td className="px-4 py-2">
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">{c.statement}</div>
              </td>
              <td className="px-4 py-2 text-slate-600">{c.controlType}</td>
              <td className="px-4 py-2 text-slate-600">{c.isHsseCritical ? 'Yes' : '—'}</td>
              <td className="px-4 py-2 text-slate-600 text-center">{c._count.controlAssignments}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/setup/controls?edit=${c.id}`}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteButton action={deleteControl.bind(null, c.id)} />
                </div>
              </td>
            </tr>
          ))}
          {paginatedControls.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                {filteredControls.length === 0 ? 'No controls match the filter.' : 'No controls to display.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination Controls */}
      {filteredControls.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-600">
              Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, filteredControls.length)}</strong> of{' '}
              <strong>{filteredControls.length}</strong> controls
            </div>

            <div className="w-40">
              <label className="block text-xs font-medium text-slate-700 mb-1">Items Per Page</label>
              <select
                value={itemsPerPage === filteredControls.length ? 'all' : itemsPerPage}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? filteredControls.length : Number(e.target.value);
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
            {/* First Page */}
            <button
              onClick={() => updatePageInput(1)}
              disabled={currentPage === 1}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              title="First page"
            >
              ⇤ First
            </button>

            {/* Previous Page */}
            <button
              onClick={() => updatePageInput(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {/* Page Input */}
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

            {/* Next Page */}
            <button
              onClick={() => updatePageInput(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              Next →
            </button>

            {/* Last Page */}
            <button
              onClick={() => updatePageInput(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
              title="Last page"
            >
              Last ⇥
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
