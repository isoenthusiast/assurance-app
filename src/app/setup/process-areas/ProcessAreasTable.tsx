'use client';

import { useState, Fragment, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DeleteButton from '@/components/DeleteButton';

type ProcessArea = {
  id: string;
  name: string;
  description: string | null;
  pId?: string | null;
  standard?: string | null;
  _count: { subProcesses: number; controls: number; requirements: number };
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
  _count: { controlSubProcesses: number };
  assessmentCount: number;
  assessments: AssessmentSummary[];
};

type ControlSummary = {
  id: string;
  name: string;
  controlType: string;
  controlRef: string | null;
  isHsseCritical: boolean;
  ramRating: string | null;
  rawHealthScore: number;
  lastTestedDate: string | Date | null;
  lastTestResult: string | null;
  _count: { controlAssignments: number };
};

type Requirement = {
  rId: number;
  requirementId: string;
  clauseContent: string;
  intentOutcome: string;
  clauseApplicability: string;
  references: string | null;
  applicable: boolean;
  standard: string;
  pId: string;
  processAreaId: string | null;
  _count: { controlMappings: number };
  controlMappings: { control: ControlSummary }[];
};

export default function ProcessAreasTable({
  areas,
  standards,
  deleteAction,
  subProcesses,
  requirements,
  deleteSubProcessAction,
  onAddClick,
  onAddSubProcessClick,
  isAdmin,
}: {
  areas: ProcessArea[];
  standards: string[];
  deleteAction: (id: string) => Promise<void>;
  subProcesses: SubProcess[];
  requirements: Requirement[];
  deleteSubProcessAction: (id: string) => Promise<void>;
  onAddClick: (defaultStandard: string) => void;
  onAddSubProcessClick: (processAreaId: string, processAreaName: string) => void;
  isAdmin: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedReqIds, setExpandedReqIds] = useState<Set<number>>(new Set());
  const [detailReq, setDetailReq] = useState<Requirement | null>(null);

  // Drag-and-drop state
  const [dragCtrlId, setDragCtrlId] = useState<string | null>(null);
  const [dragOverReqId, setDragOverReqId] = useState<number | null>(null);
  const [dragMoving, setDragMoving] = useState(false);

  // Local mutable copy of requirements for instant UI updates
  const [reqs, setReqs] = useState<Requirement[]>(requirements);
  useEffect(() => { setReqs(requirements); }, [requirements]);

  const router = useRouter();

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

  const toggleReqExpanded = (rId: number) => {
    setExpandedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(rId)) {
        next.delete(rId);
      } else {
        next.add(rId);
      }
      return next;
    });
  };

  const handleDropControl = async (ctrlId: string, targetReqRId: number) => {
    if (!ctrlId || dragMoving) return;
    setDragMoving(true);
    
    // Find the source requirement (the one currently holding this control)
    const sourceReq = reqs.find((r) =>
      r.controlMappings.some((m) => m.control.id === ctrlId)
    );
    if (!sourceReq || sourceReq.rId === targetReqRId) {
      setDragMoving(false);
      return; // Same requirement — no-op
    }

    // Find the control object being moved
    const mapping = sourceReq.controlMappings.find((m) => m.control.id === ctrlId);
    if (!mapping) { setDragMoving(false); return; }
    const control = mapping.control;

    // Optimistic local update
    setReqs((prev) =>
      prev.map((r) => {
        if (r.rId === sourceReq.rId) {
          return {
            ...r,
            controlMappings: r.controlMappings.filter((m) => m.control.id !== ctrlId),
            _count: { ...r._count, controlMappings: r._count.controlMappings - 1 },
          };
        }
        if (r.rId === targetReqRId) {
          // Avoid duplicate
          if (r.controlMappings.some((m) => m.control.id === ctrlId)) return r;
          return {
            ...r,
            controlMappings: [...r.controlMappings, { control }],
            _count: { ...r._count, controlMappings: r._count.controlMappings + 1 },
          };
        }
        return r;
      })
    );

    // Persist to server in background
    try {
      const res = await fetch(`/api/admin/table/MapControl2Requirement/data?controlId=${ctrlId}`);
      if (res.ok) {
        const data = await res.json();
        const existing = (data.rows || []).find((r: any) => r.controlId === ctrlId);
        if (existing) {
          await fetch(`/api/admin/table/MapControl2Requirement/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requirementRId: targetReqRId }),
          });
        }
      }
      // Background refresh to sync with server state
      router.refresh();
    } catch (e) {
      console.error('Drag-drop mapping failed:', e);
      // Revert on failure: reload from server
      router.refresh();
    } finally {
      setDragMoving(false);
    }
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
          <div className="px-4 py-2">Requirements</div>
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

          return (
            <Fragment key={area.id}>
              <div className="grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] border-t border-slate-100">
                <div className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(area.id)}
                    className="text-slate-500 hover:text-slate-900"
                    aria-label={isExpanded ? 'Collapse requirements' : 'Expand requirements'}
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
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {area.name}
                  </Link>
                </div>
                <div className="px-4 py-2 text-slate-600">{area.description}</div>
                <div className="px-4 py-2 text-slate-600">{area._count.requirements}</div>
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
                    <div className="px-4 py-1.5">Requirement ID</div>
                    <div className="px-4 py-1.5">Clause Content</div>
                    <div></div>
                    <div className="px-4 py-1.5">Controls</div>
                    <div></div>
                    <div></div>
                  </div>

                  {(() => {
                    const areaReqs = reqs.filter((r) => r.processAreaId === area.id);
                    return areaReqs.length > 0 ? (
                      areaReqs.map((req) => {
                        const isReqExpanded = expandedReqIds.has(req.rId);
                        const controls = req.controlMappings.map((m) => m.control).sort((a, b) => a.name.localeCompare(b.name));
                        return (
                          <Fragment key={req.rId}>
                            <div
                              className={`grid grid-cols-[32px_72px_1fr_1.6fr_130px_100px_120px_140px] border-t border-slate-200 cursor-pointer transition-colors ${
                                dragOverReqId === req.rId ? 'bg-blue-100 border-blue-400 border-2' : 'hover:bg-white'
                              }`}
                              onClick={() => toggleReqExpanded(req.rId)}
                              onDragOver={isAdmin ? (e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverReqId(req.rId);
                              } : undefined}
                              onDragLeave={isAdmin ? () => setDragOverReqId(null) : undefined}
                              onDrop={isAdmin ? (e) => {
                                e.preventDefault();
                                setDragOverReqId(null);
                                if (dragCtrlId && dragCtrlId !== req.rId.toString()) {
                                  handleDropControl(dragCtrlId, req.rId);
                                }
                              } : undefined}
                            >
                              <div className="px-2 py-2 text-center text-slate-400">
                                {isReqExpanded ? '▾' : '▸'}
                              </div>
                              <div></div>
                              <div className="px-4 py-2 text-xs">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDetailReq(req); }}
                                  className="font-medium text-blue-600 hover:underline text-left"
                                >
                                  {req.requirementId}
                                </button>
                              </div>
                              <div className="px-4 py-2 text-slate-600 text-xs leading-relaxed">
                                {dragOverReqId === req.rId ? (
                                  <span className="text-blue-600 font-medium animate-pulse">Drop control here...</span>
                                ) : (
                                  <span dangerouslySetInnerHTML={{
                                    __html: (req.clauseContent || "")
                                      .replace(/\n/g, " ")
                                      .replace(/\s+/g, " ")
                                      .replace(/\bshall\b/gi, "<strong class=\"font-bold text-slate-900\">shall</strong>")
                                  }} />
                                )}
                              </div>
                              <div></div>
                              <div className="px-4 py-2 text-slate-600">{req._count.controlMappings}</div>
                              <div></div>
                              <div></div>
                            </div>

                            {/* Expanded: linked controls sub-table */}
                            {isReqExpanded && (
                              <div className="border-t border-slate-200 bg-slate-100">
                                {controls.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-200">
                                        <tr>
                                          <th className="px-1 py-1.5 w-5">{isAdmin ? '' : ''}</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Control</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Type</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Ref</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Health</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Risk</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Last Tested</th>
                                          <th className="px-4 py-1.5 text-left font-medium text-slate-600">Result</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {controls.map((c) => (
                                          <tr
                                            key={c.id}
                                            draggable={isAdmin}
                                            onDragStart={isAdmin ? (e) => {
                                              setDragCtrlId(c.id);
                                              e.dataTransfer.effectAllowed = 'move';
                                              e.dataTransfer.setData('text/plain', c.id);
                                            } : undefined}
                                            onDragEnd={isAdmin ? () => { setDragCtrlId(null); setDragOverReqId(null); } : undefined}
                                            className={`border-t border-slate-100 transition-colors ${
                                              isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
                                            } ${
                                              dragCtrlId === c.id ? 'opacity-40 bg-blue-50' : 'hover:bg-white'
                                            }`}
                                          >
                                            {isAdmin && <td className="px-1 py-1.5 text-slate-300 text-center select-none" title="Drag to move to another requirement">⋮⋮</td>}
                                            <td className="px-4 py-1.5 font-medium text-slate-900">{c.name}</td>
                                            <td className="px-4 py-1.5 text-slate-600">{c.controlType}</td>
                                            <td className="px-4 py-1.5 text-slate-500 font-mono">{c.controlRef || '—'}</td>
                                            <td className="px-4 py-1.5">
                                              {c._count.controlAssignments === 0 ? (
                                                <span className="text-red-500 font-medium">0</span>
                                              ) : (
                                                <span className={`font-medium ${c.rawHealthScore > 80 ? 'text-green-600' : c.rawHealthScore > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                  {c.rawHealthScore}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-1.5">
                                              <span className={c.isHsseCritical ? 'text-red-600 font-medium' : 'text-slate-600'}>
                                                {c.isHsseCritical ? 'HSSE Critical' : c.ramRating || '—'}
                                              </span>
                                            </td>
                                            <td className="px-4 py-1.5 text-slate-600">
                                              {c._count.controlAssignments === 0 ? (
                                                <span className="text-slate-400 italic">Never Tested</span>
                                              ) : c.lastTestedDate ? (
                                                formatDate(c.lastTestedDate)
                                              ) : ('—')}
                                            </td>
                                            <td className="px-4 py-1.5">
                                              {c._count.controlAssignments === 0 ? (
                                                <span className="text-slate-400 italic">—</span>
                                              ) : (
                                                <span className={`font-medium ${c.lastTestResult === 'Pass' ? 'text-green-600' : c.lastTestResult === 'Fail' ? 'text-red-600' : 'text-slate-400'}`}>
                                                  {c.lastTestResult || '—'}
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="px-4 py-3 text-center text-slate-400">
                                    No controls mapped to this requirement.
                                  </div>
                                )}
                              </div>
                            )}
                          </Fragment>
                        );
                      })
                    ) : (
                      <div className="border-t border-slate-200 px-4 py-3 text-center text-slate-400">
                        No Requirements under this Process Area yet.
                      </div>
                    );
                  })()}
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

      {/* ─── REQUIREMENT DETAIL MODAL (View Only) ────────────────────── */}
      {detailReq && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 overflow-y-auto" onClick={() => setDetailReq(null)}>
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl mx-4 mb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Requirement: {detailReq.requirementId}
              </h3>
              <button
                onClick={() => setDetailReq(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">rID</label>
                  <p className="text-sm text-slate-900">{detailReq.rId}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Applicable</label>
                  <p className="text-sm text-slate-900">{detailReq.applicable ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Standard</label>
                  <p className="text-sm text-slate-900">{detailReq.standard || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">pID</label>
                  <p className="text-sm text-slate-900 font-mono">{detailReq.pId || '—'}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Requirement ID</label>
                <p className="text-sm text-slate-900 font-mono">{detailReq.requirementId}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Clause Content</label>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded p-3 border border-slate-100">{detailReq.clauseContent || '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Intent / Outcome</label>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded p-3 border border-slate-100">{detailReq.intentOutcome || '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Clause Applicability</label>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded p-3 border border-slate-100">{detailReq.clauseApplicability || '—'}</p>
              </div>
              {detailReq.references && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">References</label>
                  <p className="text-sm text-slate-700">{detailReq.references}</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Linked Controls</label>
                <p className="text-sm text-slate-900">{detailReq._count.controlMappings}</p>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setDetailReq(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
