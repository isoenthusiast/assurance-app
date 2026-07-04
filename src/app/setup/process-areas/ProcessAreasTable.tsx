'use client';

import { useState, Fragment } from 'react';
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

type AssessmentSummary = {
  id: string;
  name: string;
  endDate: string | Date | null;
  status: string;
  findingsCount: number;
  actionsCount: number;
};

type SubProcess = {
  id: string;
  name: string;
  description: string | null;
  processAreaId: string;
  _count: { controls: number };
  assessmentCount: number;
  assessments: AssessmentSummary[];
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function ProcessAreasTable({
  areas,
  standards,
  deleteAction,
  subProcesses,
  deleteSubProcessAction,
  onAddClick,
  onAddSubProcessClick,
}: {
  areas: ProcessArea[];
  standards: string[];
  deleteAction: (id: string) => Promise<void>;
  subProcesses: SubProcess[];
  deleteSubProcessAction: (id: string) => Promise<void>;
  onAddClick: (defaultStandard: string) => void;
  onAddSubProcessClick: (processAreaId: string, processAreaName: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedSubProcessIds, setExpandedSubProcessIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSubProcessExpanded = (id: string) => {
    setExpandedSubProcessIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
      <div className="mt-6 rounded border border-slate-200 bg-white p-4">
        <nav className="flex items-stretch gap-1 border-b border-slate-200">
          <button
            onClick={() => {
              setSelectedStandard('');
              setCurrentPage(1);
            }}
            className={`min-w-0 flex-1 rounded-t px-2 py-2 text-center text-sm leading-snug ${
              selectedStandard === ''
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Standards
          </button>
          {standards.map((standard) => (
            <button
              key={standard}
              onClick={() => {
                setSelectedStandard(standard);
                setCurrentPage(1);
              }}
              className={`min-w-0 flex-1 rounded-t px-2 py-2 text-center text-sm leading-snug ${
                selectedStandard === standard
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {standard}
            </button>
          ))}
        </nav>
      </div>

      {/*
        Built with CSS grid (not a real <table>) so the parent row's Name /
        Description / Controls / Actions columns and the nested sub-process
        rows share one exact column layout — pixel-aligned regardless of
        content, which two independently-auto-sized <table> elements can't
        guarantee.
      */}
      <div className="mt-4 overflow-hidden rounded border border-slate-200 bg-white text-sm">
        <div className="grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] bg-slate-100 text-left font-medium text-slate-600">
          <div className="px-2 py-2"></div>
          <div className="px-4 py-2">pId</div>
          <div className="px-4 py-2">Process Area</div>
          <div className="px-4 py-2">Description</div>
          <div className="px-4 py-2">Sub-Processes</div>
          <div className="px-4 py-2">Controls</div>
          <div className="px-4 py-2"></div>
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => onAddClick(selectedStandard)}
              className="font-medium text-slate-900 hover:underline"
            >
              +Add Process
            </button>
          </div>
        </div>

        {paginatedAreas.map((area) => {
          const isExpanded = expandedIds.has(area.id);
          const areaSubProcesses = subProcesses.filter((sp) => sp.processAreaId === area.id);

          return (
            <Fragment key={area.id}>
              <div className="grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] border-t border-slate-100">
                <div className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(area.id)}
                    className="text-slate-500 hover:text-slate-900"
                    aria-label={isExpanded ? 'Collapse sub-processes' : 'Expand sub-processes'}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                </div>
                <div className="px-4 py-2 text-slate-600 font-mono text-xs">{area.pId || '—'}</div>
                <div className="px-4 py-2">
                  <Link
                    href={`/setup/processdetails/${area.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {area.name}
                  </Link>
                </div>
                <div className="px-4 py-2 text-slate-600">{area.description}</div>
                <div className="px-4 py-2 text-slate-600">{area._count.subProcesses}</div>
                <div className="px-4 py-2 text-slate-600">{area._count.controls}</div>
                <div className="px-4 py-2"></div>
                <div className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/setup/process-areas?edit=${area.id}`}
                      className="text-sm text-slate-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <DeleteButton action={deleteAction.bind(null, area.id)} />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <div className="grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <div></div>
                    <div></div>
                    <div className="px-4 py-1.5">Sub-Process</div>
                    <div className="px-4 py-1.5">Description</div>
                    <div></div>
                    <div className="px-4 py-1.5">Controls</div>
                    <div className="px-4 py-1.5">Assessments</div>
                    <div className="px-4 py-1.5 normal-case tracking-normal">
                      <button
                        type="button"
                        onClick={() => onAddSubProcessClick(area.id, area.name)}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        +Add SubProcess
                      </button>
                    </div>
                  </div>

                  {areaSubProcesses.map((sp) => {
                    const isSubExpanded = expandedSubProcessIds.has(sp.id);
                    return (
                      <Fragment key={sp.id}>
                        <div className="grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] border-t border-slate-200">
                          <div className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSubProcessExpanded(sp.id)}
                              className="text-slate-500 hover:text-slate-900"
                              aria-label={isSubExpanded ? 'Collapse assessments' : 'Expand assessments'}
                              aria-expanded={isSubExpanded}
                            >
                              {isSubExpanded ? '▾' : '▸'}
                            </button>
                          </div>
                          <div></div>
                          <div className="px-4 py-2 font-medium text-slate-900">{sp.name}</div>
                          <div className="px-4 py-2 text-slate-600">{sp.description}</div>
                          <div></div>
                          <div className="px-4 py-2 text-slate-600">{sp._count.controls}</div>
                          <div className="px-4 py-2 text-slate-600">{sp.assessmentCount}</div>
                          <div className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/setup/sub-processes?edit=${sp.id}`}
                                className="text-sm text-slate-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <DeleteButton action={deleteSubProcessAction.bind(null, sp.id)} />
                            </div>
                          </div>
                        </div>

                        {isSubExpanded && (
                          <div className="border-t border-slate-200 bg-slate-100 px-4 py-3">
                            <div className="overflow-hidden rounded border border-slate-200 bg-white text-xs">
                              <div className="grid grid-cols-[1fr_120px_120px_100px_100px] bg-slate-100 font-medium text-slate-600">
                                <div className="px-3 py-1.5">Assessment Title</div>
                                <div className="px-3 py-1.5">Assessment End Date</div>
                                <div className="px-3 py-1.5">Assessment Status</div>
                                <div className="px-3 py-1.5">Number of Findings</div>
                                <div className="px-3 py-1.5">Number of Actions</div>
                              </div>
                              {sp.assessments.map((a) => (
                                <div
                                  key={a.id}
                                  className="grid grid-cols-[1fr_120px_120px_100px_100px] border-t border-slate-100"
                                >
                                  <div className="px-3 py-1.5">
                                    <Link href={`/fla/${a.id}`} className="text-blue-600 hover:underline">
                                      {a.name}
                                    </Link>
                                  </div>
                                  <div className="px-3 py-1.5 text-slate-600">{formatDate(a.endDate)}</div>
                                  <div className="px-3 py-1.5 text-slate-600">{a.status}</div>
                                  <div className="px-3 py-1.5 text-slate-600">{a.findingsCount}</div>
                                  <div className="px-3 py-1.5 text-slate-600">{a.actionsCount}</div>
                                </div>
                              ))}
                              {sp.assessments.length === 0 && (
                                <div className="border-t border-slate-100 px-3 py-3 text-center text-slate-400">
                                  No completed assessments have tested this Sub-Process&apos;s controls yet.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                  {areaSubProcesses.length === 0 && (
                    <div className="border-t border-slate-200 px-4 py-3 text-center text-slate-400">
                      No Sub-Processes under this Process Area yet.
                    </div>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
        {paginatedAreas.length === 0 && (
          <div className="border-t border-slate-100 px-4 py-6 text-center text-slate-400">
            {selectedStandard ? 'No Process Areas found with this Standard.' : 'No Process Areas yet.'}
          </div>
        )}
      </div>

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
