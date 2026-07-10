"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type ProcessArea = { id: string; name: string; description?: string | null };
type SubProcess = { id: string; name: string; processAreaId: string };
type ControlFDSP = {
  id: string;
  controlFromDocumentId: string;
  subProcessId: string;
  isPrimary: boolean;
};
type ControlFD = {
  id: string;
  name: string;
  statement: string;
  controlType: string;
  controlRef?: string | null;
  sourceFile?: string | null;
  documentExtractId: string;
  csfWho?: string | null;
  csfWhat?: string | null;
  isHsseCritical: boolean;
  riskWeight: number;
  testingApproach?: string | null;
};

type TreeSubProcess = {
  id: string;
  name: string;
  controls: ControlFD[];
};

type TreeNode = {
  id: string;
  name: string;
  description: string | null;
  subProcesses: TreeSubProcess[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchTable(table: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`/api/admin/table/${table}/data?perPage=5000`);
  if (!res.ok) throw new Error(`Failed to fetch ${table}`);
  const d = await res.json();
  return d.rows || [];
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DocumentControlsPage() {
  return <DocumentControlsManager />;
}

export function DocumentControlsManager() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [expandedSPs, setExpandedSPs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedControl, setSelectedControl] = useState<ControlFD | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pas, sps, junctions, controls] = await Promise.all([
        fetchTable("ProcessArea"),
        fetchTable("SubProcess"),
        fetchTable("ControlFDSubProcess"),
        fetchTable("ControlFromDocument"),
      ]);

      const paMap = new Map<string, ProcessArea>();
      (pas as unknown as ProcessArea[]).forEach((pa) => paMap.set(pa.id, pa));

      const spMap = new Map<string, SubProcess[]>();
      (sps as unknown as SubProcess[]).forEach((sp) => {
        if (!spMap.has(sp.processAreaId)) spMap.set(sp.processAreaId, []);
        spMap.get(sp.processAreaId)!.push(sp);
      });

      const cfMap = new Map<string, ControlFD>();
      (controls as unknown as ControlFD[]).forEach((c) => cfMap.set(c.id, c));

      // Build junction: subProcessId → ControlFD[]
      const spControls = new Map<string, ControlFD[]>();
      (junctions as unknown as ControlFDSP[]).forEach((j) => {
        const cf = cfMap.get(j.controlFromDocumentId);
        if (!cf) return;
        if (!spControls.has(j.subProcessId)) spControls.set(j.subProcessId, []);
        spControls.get(j.subProcessId)!.push(cf);
      });

      // Build tree
      const nodes: TreeNode[] = [];
      paMap.forEach((pa) => {
        const spList = spMap.get(pa.id) || [];
        const subNodes: TreeSubProcess[] = spList.map((sp) => ({
          id: sp.id,
          name: sp.name,
          controls: spControls.get(sp.id) || [],
        }));
        // Only include PAs that have subprocesses with controls
        if (subNodes.some((s) => s.controls.length > 0)) {
          nodes.push({
            id: pa.id,
            name: pa.name,
            description: pa.description || null,
            subProcesses: subNodes,
          });
        }
      });

      setTree(nodes);
      // Auto-expand the first area
      if (nodes.length > 0) {
        setExpandedAreas(new Set([nodes[0].id]));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    return tree
      .map((pa) => ({
        ...pa,
        subProcesses: pa.subProcesses
          .map((sp) => ({
            ...sp,
            controls: sp.controls.filter(
              (c) =>
                c.name.toLowerCase().includes(q) ||
                (c.statement || "").toLowerCase().includes(q) ||
                (c.controlRef || "").toLowerCase().includes(q) ||
                (c.csfWhat || "").toLowerCase().includes(q) ||
                sp.name.toLowerCase().includes(q)
            ),
          }))
          .filter((sp) => sp.controls.length > 0),
      }))
      .filter((pa) => pa.subProcesses.length > 0);
  }, [tree, search]);

  const toggleArea = (id: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSP = (id: string) => {
    setExpandedSPs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalControls = useMemo(
    () => tree.reduce((sum, pa) => sum + pa.subProcesses.reduce((s, sp) => s + sp.controls.length, 0), 0),
    [tree]
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-400">
        Loading document controls...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Error: {error}
          <button onClick={loadData} className="ml-3 underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3 p-3">
      {/* LEFT: Tree */}
      <div className="w-80 flex-shrink-0 flex flex-col rounded-lg border border-slate-200 bg-white">
        <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            📄 Document Controls ({totalControls})
          </span>
          <button
            onClick={loadData}
            className="text-blue-600 hover:underline text-xs"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        <div className="px-2 py-1.5 border-b border-slate-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search controls, sub-processes..."
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTree.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">
              {search ? "No matches found." : "No document-extracted controls yet."}
            </div>
          ) : (
            filteredTree.map((pa) => (
              <div key={pa.id} className="border-b border-slate-50">
                {/* Process Area */}
                <button
                  onClick={() => toggleArea(pa.id)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <span className="text-xs text-slate-400">
                    {expandedAreas.has(pa.id) ? "▼" : "▶"}
                  </span>
                  <span className="text-xs font-medium text-slate-700 truncate flex-1">
                    {pa.name}
                  </span>
                  <span className="text-2xs text-slate-400">
                    {pa.subProcesses.reduce((s, sp) => s + sp.controls.length, 0)}
                  </span>
                </button>

                {/* SubProcesses */}
                {expandedAreas.has(pa.id) &&
                  pa.subProcesses
                    .filter((sp) => sp.controls.length > 0 || !search)
                    .map((sp) => (
                      <div key={sp.id}>
                        <button
                          onClick={() => toggleSP(sp.id)}
                          className="w-full text-left pl-7 pr-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                        >
                          <span className="text-xs text-slate-400">
                            {expandedSPs.has(sp.id) ? "▼" : "▶"}
                          </span>
                          <span className="text-xs text-slate-600 truncate flex-1">
                            {sp.name}
                          </span>
                          <span className="text-2xs text-slate-400">
                            {sp.controls.length}
                          </span>
                        </button>

                        {/* Controls */}
                        {expandedSPs.has(sp.id) &&
                          sp.controls.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedControl(c)}
                              className={`w-full text-left pl-11 pr-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 text-xs ${
                                selectedControl?.id === c.id
                                  ? "bg-blue-50 border-l-2 border-l-blue-500"
                                  : ""
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  c.isHsseCritical ? "bg-red-500" : "bg-slate-300"
                                }`}
                                title={c.isHsseCritical ? "HSSE Critical" : ""}
                              />
                              <span className="truncate text-slate-700">
                                {c.name}
                              </span>
                              {c.controlRef && (
                                <span className="text-2xs text-slate-400 flex-shrink-0">
                                  {c.controlRef}
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Control Detail */}
      <div className="flex-1 rounded-lg border border-slate-200 bg-white flex flex-col min-w-0">
        {selectedControl ? (
          <>
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-sm">
                  {selectedControl.name}
                </span>
                {selectedControl.controlRef && (
                  <span className="text-xs text-slate-400 ml-2">
                    {selectedControl.controlRef}
                  </span>
                )}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  selectedControl.isHsseCritical
                    ? "bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {selectedControl.isHsseCritical ? "HSSE Critical" : "Standard"} ·{" "}
                {selectedControl.controlType}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Statement */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Control Statement
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedControl.statement || "—"}
                </p>
              </div>

              {/* CSF Fields */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Who", selectedControl.csfWho],
                  ["What", selectedControl.csfWhat],
                  ["Risk Weight", selectedControl.riskWeight],
                  ["Source File", selectedControl.sourceFile],
                  [
                    "Testing Approach",
                    selectedControl.testingApproach,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="text-2xs text-slate-400 uppercase">{label}</span>
                    <p className="text-xs text-slate-700">
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Document Extract Info */}
              {selectedControl.documentExtractId && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  <span className="text-xs font-medium text-amber-800">
                    📎 Extracted from Document
                  </span>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Document ID: {selectedControl.documentExtractId}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <div className="text-3xl">📄</div>
            <div className="text-sm">Select a control to view details</div>
            <div className="text-xs text-slate-300">
              {totalControls} document-extracted controls across {tree.length} process areas
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
