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
  processArea: { id: string; name: string; standard: string | null };
  subProcess: { id: string; name: string };
  _count: { controlAssignments: number };
  controlAssignments: {
    assessmentId: string;
    effective: string | null;
    assessment: { endDate: string | Date | null };
  }[];
};

type ProcessArea = { id: string; name: string; standard: string | null };
type SubProcess = { id: string; name: string; processAreaId: string };

// Sentinel key for process areas that have no "standard" value set, so they
// still show up under their own group instead of being silently dropped.
const UNSPECIFIED_STANDARD = '__unspecified_standard__';

// Preferred display order for standards. Items not in this list are appended
// alphabetically. "International Standards (ISO)" is intentionally placed
// after the domain-specific standards.
const STANDARD_ORDER = [
  "Carbon, Environment, Social Performance, Product Stewardship & Quality",
  "HSSE & SP and Asset Management Foundations",
  "Process Safety & Asset Management",
  "Transport Safety",
  "Workplace Health, Safety & Security",
  "International Standards (ISO)",
];

function sortStandards(standards: string[]): string[] {
  const orderMap = new Map(STANDARD_ORDER.map((s, i) => [s, i]));
  return [...standards].sort((a, b) => {
    const ai = orderMap.get(a);
    const bi = orderMap.get(b);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.localeCompare(b);
  });
}

// A control's "last tested" state comes from the most recently *completed*
// assessment it was assigned to (i.e. the assignment whose assessment has
// the latest endDate). Assignments tied to an assessment that hasn't
// finished yet (endDate still null) aren't counted as a test.
function getLatestTest(control: Control) {
  const completed = control.controlAssignments.filter((ca) => ca.assessment.endDate);
  if (completed.length === 0) return null;
  return completed.reduce((latest, ca) =>
    new Date(ca.assessment.endDate as string | Date).getTime() >
    new Date(latest.assessment.endDate as string | Date).getTime()
      ? ca
      : latest
  );
}

// Effective / Not Effective link back to the assessment that produced that
// verdict. "Never Tested" instead links out to start a brand new assessment,
// since there's no existing test result to review.
function getEffectiveDisplay(
  control: Control
): { label: string; href: string; title: string } {
  const latestTest = getLatestTest(control);

  if (latestTest?.effective === 'Effective') {
    return {
      label: 'Effective',
      href: `/fla/${latestTest.assessmentId}`,
      title: 'Open the assessment this result came from',
    };
  }
  if (latestTest?.effective === 'NotEffective') {
    return {
      label: 'Not Effective',
      href: `/fla/${latestTest.assessmentId}`,
      title: 'Open the assessment this result came from',
    };
  }

  return {
    label: 'Never Tested',
    href: '/admin/assessments/new',
    title: 'Add new assessment now',
  };
}

export default function ControlsTable({
  controls,
  processAreas,
  subProcesses,
}: {
  controls: Control[];
  processAreas: ProcessArea[];
  subProcesses: SubProcess[];
}) {
  const [selectedStandard, setSelectedStandard] = useState<string>('all');
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string>('all');
  const [hoveredStandard, setHoveredStandard] = useState<string | null>(null);
  const [hoveredPAId, setHoveredPAId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const standardKey = (standard: string | null) => (standard && standard.trim() ? standard.trim() : UNSPECIFIED_STANDARD);

  // Tier 1: distinct standards, derived from the process areas that carry them.
  const standards = useMemo(() => {
    const set = new Set<string>();
    let hasUnspecified = false;
    processAreas.forEach((pa) => {
      if (pa.standard && pa.standard.trim()) {
        set.add(pa.standard.trim());
      } else {
        hasUnspecified = true;
      }
    });
    const sorted = sortStandards(Array.from(set));
    return hasUnspecified ? [...sorted, UNSPECIFIED_STANDARD] : sorted;
  }, [processAreas]);

  const resetSelectionState = () => {
    setCurrentPage(1);
    setPageInput('1');
    setHoveredStandard(null);
    setHoveredPAId(null);
  };

  // Click a Standard (Tier 1) — filters to every control under it.
  const handleSelectStandard = (standard: string) => {
    setSelectedStandard(standard);
    setSelectedProcessAreaId('all');
    setSelectedSubProcessId('all');
    resetSelectionState();
  };

  // Click a Process Area (Tier 2) — filters to that process area exactly.
  const handleSelectProcessArea = (pa: ProcessArea) => {
    setSelectedStandard(standardKey(pa.standard));
    setSelectedProcessAreaId(pa.id);
    setSelectedSubProcessId('all');
    resetSelectionState();
  };

  // Click a Sub-Process (Tier 3) — the most specific filter.
  const handleSelectSubProcess = (pa: ProcessArea, subProcessId: string) => {
    setSelectedStandard(standardKey(pa.standard));
    setSelectedProcessAreaId(pa.id);
    setSelectedSubProcessId(subProcessId);
    resetSelectionState();
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
      const matchStandard =
        selectedStandard === 'all' || standardKey(control.processArea.standard) === selectedStandard;

      const matchProcessArea =
        selectedProcessAreaId === 'all' || control.processArea.id === selectedProcessAreaId;

      const matchSubProcess =
        selectedSubProcessId === 'all' || control.subProcess.id === selectedSubProcessId;

      return matchStandard && matchProcessArea && matchSubProcess;
    });
  }, [controls, selectedStandard, selectedProcessAreaId, selectedSubProcessId]);

  // Pagination
  const totalPages = Math.ceil(filteredControls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedControls = filteredControls.slice(startIndex, endIndex);

  return (
    <div className="mt-6 space-y-4">
      {/* Filters */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <nav className="flex items-stretch gap-1 border-b border-slate-200">
          <button
            onClick={() => handleSelectStandard('all')}
            className={`min-w-0 flex-1 rounded-t px-2 py-2 text-center text-sm leading-snug ${
              selectedStandard === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            All Standards
          </button>

          {standards.map((std) => {
            const stdLabel = std === UNSPECIFIED_STANDARD ? 'Unspecified' : std;
            const stdProcessAreas = processAreas
              .filter((pa) => standardKey(pa.standard) === std)
              .sort((a, b) => a.name.localeCompare(b.name));
            const isStdActive = selectedStandard === std;
            const isStdOpen = hoveredStandard === std;

            return (
              <div
                key={std}
                className="relative min-w-0 flex-1"
                onMouseEnter={() => setHoveredStandard(std)}
                onMouseLeave={() =>
                  setHoveredStandard((cur) => (cur === std ? null : cur))
                }
              >
                <button
                  onClick={() => handleSelectStandard(std)}
                  className={`w-full rounded-t px-2 py-2 text-center text-sm leading-snug ${
                    isStdActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {stdLabel}
                </button>

                {/* Tier 2: Process Areas under this Standard */}
                {isStdOpen && stdProcessAreas.length > 0 && (
                  <div className="absolute left-0 top-full z-20 min-w-[260px] rounded-b border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      onClick={() => handleSelectStandard(std)}
                      className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                        isStdActive && selectedProcessAreaId === 'all'
                          ? 'bg-slate-100 font-medium text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      All Process Areas
                    </button>

                    {stdProcessAreas.map((pa) => {
                      const paSubProcesses = subProcesses
                        .filter((sp) => sp.processAreaId === pa.id)
                        .sort((a, b) => a.name.localeCompare(b.name));
                      const isPaActive = selectedProcessAreaId === pa.id;
                      const isPaOpen = hoveredPAId === pa.id;

                      return (
                        <div
                          key={pa.id}
                          className="relative"
                          onMouseEnter={() => setHoveredPAId(pa.id)}
                          onMouseLeave={() =>
                            setHoveredPAId((cur) => (cur === pa.id ? null : cur))
                          }
                        >
                          <button
                            onClick={() => handleSelectProcessArea(pa)}
                            className={`flex w-full items-center justify-between whitespace-nowrap px-3 py-2 text-left text-sm ${
                              isPaActive
                                ? 'bg-slate-100 font-medium text-slate-900'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{pa.name}</span>
                            {paSubProcesses.length > 0 && (
                              <span className="ml-2 text-slate-400">›</span>
                            )}
                          </button>

                          {/* Tier 3: Sub-Processes under this Process Area */}
                          {isPaOpen && paSubProcesses.length > 0 && (
                            <div className="absolute left-full top-0 z-30 min-w-[240px] rounded border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => handleSelectSubProcess(pa, 'all')}
                                className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                                  isPaActive && selectedSubProcessId === 'all'
                                    ? 'bg-slate-100 font-medium text-slate-900'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                All Sub-Processes
                              </button>
                              {paSubProcesses.map((sp) => (
                                <button
                                  key={sp.id}
                                  onClick={() => handleSelectSubProcess(pa, sp.id)}
                                  className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                                    isPaActive && selectedSubProcessId === sp.id
                                      ? 'bg-slate-100 font-medium text-slate-900'
                                      : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {sp.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-2 text-xs text-slate-500">
          Showing:{' '}
          <span className="font-medium text-slate-700">
            {selectedStandard === 'all'
              ? 'All Standards'
              : selectedStandard === UNSPECIFIED_STANDARD
              ? 'Unspecified'
              : selectedStandard}
          </span>
          {selectedProcessAreaId !== 'all' && (
            <>
              {' '}
              /{' '}
              <span className="font-medium text-slate-700">
                {processAreas.find((pa) => pa.id === selectedProcessAreaId)?.name}
              </span>
            </>
          )}
          {selectedSubProcessId !== 'all' && (
            <>
              {' '}
              /{' '}
              <span className="font-medium text-slate-700">
                {subProcesses.find((sp) => sp.id === selectedSubProcessId)?.name}
              </span>
            </>
          )}
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
            <th className="px-4 py-2">Last Tested</th>
            <th className="px-4 py-2">Effective</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {paginatedControls.map((c) => {
            const latestTest = getLatestTest(c);
            const effectiveInfo = getEffectiveDisplay(c);
            return (
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
                <td className="px-4 py-2 text-slate-600">
                  {latestTest ? new Date(latestTest.assessment.endDate as string | Date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  <Link
                    href={effectiveInfo.href}
                    className="text-blue-600 hover:underline"
                    title={effectiveInfo.title}
                  >
                    {effectiveInfo.label}
                  </Link>
                </td>
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
            );
          })}
          {paginatedControls.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
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
