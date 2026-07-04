'use client';

import { useState } from 'react';
import Link from 'next/link';
import DeleteButton from '@/components/DeleteButton';

type ActivityType = {
  id: string;
  name: string;
  defaultLOA: string;
  description: string | null;
  _count: { assessments: number };
};

type LOAOption = {
  value: string;
  label: string;
};

export default function ActivityTypesTable({
  types,
  loaOptions,
  deleteAction,
  onAddClick,
}: {
  types: ActivityType[];
  loaOptions: LOAOption[];
  deleteAction: (id: string) => Promise<void>;
  onAddClick: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorted by Default LOA in loaOptions order (1st Line, 2nd Line, 3rd Line)
  // rather than the raw enum string; ties keep the incoming name-asc order
  // (Array.sort is stable) since that's how `types` already arrives.
  const sortedTypes = [...types].sort((a, b) => {
    const aIndex = loaOptions.findIndex((o) => o.value === a.defaultLOA);
    const bIndex = loaOptions.findIndex((o) => o.value === b.defaultLOA);
    return aIndex - bIndex;
  });

  const totalPages = Math.ceil(sortedTypes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTypes = sortedTypes.slice(startIndex, endIndex);

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
      <table className="mt-6 w-full border-collapse overflow-hidden rounded border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Default LOA</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Assessments</th>
            <th className="px-4 py-2">
              <button
                type="button"
                onClick={onAddClick}
                className="font-medium text-slate-900 hover:underline"
              >
                +Add Activity Type
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedTypes.map((type) => (
            <tr key={type.id} className="border-t border-slate-100">
              <td className="px-4 py-2 font-medium text-slate-900">{type.name}</td>
              <td className="px-4 py-2 text-slate-600">
                {loaOptions.find((o) => o.value === type.defaultLOA)?.label}
              </td>
              <td className="px-4 py-2 text-slate-600">{type.description}</td>
              <td className="px-4 py-2 text-slate-600">{type._count.assessments}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/setup/activity-types?edit=${type.id}`}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteButton action={deleteAction.bind(null, type.id)} />
                </div>
              </td>
            </tr>
          ))}
          {paginatedTypes.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                No Activity Types yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {types.length > 0 && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-sm text-slate-600">
              Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, types.length)}</strong> of{' '}
              <strong>{types.length}</strong> activity types
            </div>

            <div className="w-40">
              <label className="block text-xs font-medium text-slate-700 mb-1">Items Per Page</label>
              <select
                value={itemsPerPage === types.length ? 'all' : itemsPerPage}
                onChange={(e) => {
                  const value = e.target.value === 'all' ? types.length : Number(e.target.value);
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
