'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { deleteControl } from './actions';
import DeleteButton from '@/components/DeleteButton';
import { formatDate } from '@/lib/formatDate';

type Control = {
  id: string;
  name: string;
  statement: string;
  controlType: string;
  isHsseCritical: boolean;
  ramRating: string | null;
  processArea: { id: string; name: string; standard: string | null };
  controlSubProcesses?: { subProcess: { id: string; name: string } }[];
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

// Get the primary sub-process for a control from its junction links
function getPrimarySubProcess(control: Control): { id: string; name: string } | null {
  if (!control.controlSubProcesses || control.controlSubProcesses.length === 0) return null;
  // If there's only one, it's primary; otherwise find the one that has isPrimary
  // (isPrimary isn't included in the list query, so we just take the first)
  return control.controlSubProcesses[0].subProcess;
}

// Get all sub-process IDs linked to a control via junction
function getLinkedSubProcessIds(control: Control): Set<string> {
  if (!control.controlSubProcesses) return new Set();
  return new Set(control.controlSubProcesses.map(csp => csp.subProcess.id));
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
  };

  // Click a Standard (Tier 1) — filters to every control under it.
  const handleSelectStandard = (standard: string) => {
    setSelectedStandard(standard);
    setSelectedProcessAreaId('all');
    setSelectedSubProcessId('all');
    resetSelectionState();
  };

  // Click a Process Area (Tier 2) — filters to that process area exactly.
  const handleSelectProcessArea = (paId: string) => {
    const pa = processAreas.find(p => p.id === paId);
    if (pa) {
      setSelectedStandard(standardKey(pa.standard));
    }
    setSelectedProcessAreaId(paId);
    setSelectedSubProcessId('all');
    resetSelectionState();
  };

  const filteredProcessAreas = selectedStandard === 'all'
    ? processAreas
    : processAreas.filter(pa => standardKey(pa.standard) === selectedStandard);

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
        selectedSubProcessId === 'all' || getLinkedSubProcessIds(control).has(selectedSubProcessId);

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
        <div className="flex flex-wrap gap-3">
          {/* Standard combo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Standard</label>
            <select
              value={selectedStandard}
              onChange={e => handleSelectStandard(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="all">All Standards</option>
              {standards.map(std => (
                <option key={std} value={std}>
                  {std === UNSPECIFIED_STANDARD ? "Unspecified" : std}
                </option>
              ))}
            </select>
          </div>

          {/* Process Area combo */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Process Area</label>
            <select
              value={selectedProcessAreaId}
              onChange={e => handleSelectProcessArea(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm max-w-xs"
            >
              <option value="all">All Process Areas</option>
              {filteredProcessAreas.map(pa => (
                <option key={pa.id} value={pa.id}>{pa.name}</option>
              ))}
            </select>
          </div>
        </div>

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
            const primarySp = getPrimarySubProcess(c);
            const otherSps = (c.controlSubProcesses || []).filter(csp => csp.subProcess.id !== (primarySp?.id ?? ""));
            return (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 text-slate-600">
                  {c.processArea.name} / {primarySp?.name ?? "—"}
                  {otherSps.length > 0 && (
                    <div className="text-xs text-slate-400">
                      +{otherSps.map(csp => csp.subProcess.name).join(", ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.statement}</div>
                </td>
                <td className="px-4 py-2 text-slate-600">{c.controlType}</td>
                <td className="px-4 py-2 text-slate-600">{c.isHsseCritical ? 'Yes' : '—'}</td>
                <td className="px-4 py-2 text-slate-600 text-center">{c._count.controlAssignments}</td>
                <td className="px-4 py-2 text-slate-600">
                  {latestTest ? formatDate(latestTest.assessment.endDate as string | Date) : '—'}
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
