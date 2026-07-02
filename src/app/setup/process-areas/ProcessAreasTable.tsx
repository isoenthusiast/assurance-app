'use client';

import { useState } from 'react';
import Link from 'next/link';
import DeleteButton from '@/components/DeleteButton';

type ProcessArea = {
  id: string;
  name: string;
  description: string | null;
  pId?: string | null;
  standard?: string | null;
  _count: { subProcesses: number; controls: number };
};

export default function ProcessAreasTable({
  areas,
  standards,
  deleteAction,
}: {
  areas: ProcessArea[];
  standards: string[];
  deleteAction: (id: string) => Promise<void>;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStandard, setSelectedStandard] = useState<string>('');

  // Filter areas by selected standard
  const filteredAreas = selectedStandard
    ? areas.filter((area) => area.standard === selectedStandard)
    : areas;

  const totalPages = Math.ceil(filteredAreas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAreas = filteredAreas.slice(startIndex, endIndex);

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

  return (
    <>
      {/* Standard Filter */}
      <div className="mt-6 rounded border border-slate-200 bg-white p-4 w-full max-w-xs">
        <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Standard</label>
        <select
          value={selectedStandard}
          onChange={(e) => {
            setSelectedStandard(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">All Standards</option>
          {standards.map((standard) => (
            <option key={standard} value={standard}>
              {standard}
            </option>
          ))}
        </select>
      </div>

      <table className="mt-4 w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2">pId</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Sub-Processes</th>
            <th className="px-4 py-2">Controls</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {paginatedAreas.map((area) => (
            <tr key={area.id} className="border-t border-slate-100">
              <td className="px-4 py-2 text-slate-600 font-mono text-xs">{area.pId || '—'}</td>
              <td className="px-4 py-2 font-medium text-slate-900">{area.name}</td>
              <td className="px-4 py-2 text-slate-600">{area.description}</td>
              <td className="px-4 py-2 text-slate-600">{area._count.subProcesses}</td>
              <td className="px-4 py-2 text-slate-600">{area._count.controls}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/setup/process-areas?edit=${area.id}`}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteButton action={deleteAction.bind(null, area.id)} />
                </div>
              </td>
            </tr>
          ))}
          {paginatedAreas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                {selectedStandard ? 'No Process Areas found with this Standard.' : 'No Process Areas yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {filteredAreas.length > 0 && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-600">
              Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, filteredAreas.length)}</strong> of{' '}
              <strong>{filteredAreas.length}</strong> process areas
              {selectedStandard && ` (filtered by: ${selectedStandard})`}
            </div>

            <div className="w-40">
              <label className="block text-xs font-medium text-slate-700 mb-1">Items Per Page</label>
              <select
                value={itemsPerPage === filteredAreas.length ? 'all' : itemsPerPage}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? filteredAreas.length : Number(e.target.value);
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
      )}
    </>
  );
}
