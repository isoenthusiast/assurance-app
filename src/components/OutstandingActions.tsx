"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import AttachmentList from "@/components/AttachmentList";

interface OutstandingAction {
  id: string;
  actionId: string | null;
  actionDescription: string;
  actionParty: string | null;
  targetDate: string | null;
  findingDescription: string;
}

interface ActionDetail {
  id: string;
  actionId: string | null;
  actionDescription: string;
  actionDetails: string | null;
  actionTaken: string | null;
  actionParty: string | null;
  auditee: string | null;
  targetDate: string | null;
  createdDate: string;
  apAgreed: boolean;
  actionClosureEffective: boolean;
  actionClosureApprovedBy: string | null;
  originalTargetDate: string | null;
  numberOfExtensions: number;
  finding: {
    id: string;
    description: string;
    details: string | null;
    severity: string;
    risks: string | null;
    controlIds: string | null;
    assessmentId: string;
    assessment: { id: string; name: string; companyId: string | null } | null;
  };
}

type SortField = "actionId" | "findingDescription" | "actionDescription" | "actionParty" | "targetDate";
type SortDir = "asc" | "desc";

interface ColumnDef {
  field: SortField;
  label: string;
  defaultWidth: number;
}

const COLUMNS: ColumnDef[] = [
  { field: "actionId", label: "Action ID", defaultWidth: 140 },
  { field: "findingDescription", label: "Finding Description", defaultWidth: 280 },
  { field: "actionDescription", label: "Action Description", defaultWidth: 300 },
  { field: "actionParty", label: "Action Party", defaultWidth: 140 },
  { field: "targetDate", label: "Target Date", defaultWidth: 120 },
];

export default function OutstandingActions({ actions }: { actions: OutstandingAction[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sortField, setSortField] = useState<SortField>("targetDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    Object.fromEntries(COLUMNS.map(c => [c.field, c.defaultWidth]))
  );
  const [resizing, setResizing] = useState<{ field: SortField; startX: number; startWidth: number } | null>(null);

  // Modal state
  const [selectedAction, setSelectedAction] = useState<ActionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ActionDetail>>({});
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s?.user) setCurrentUser({ name: s.user.name || "", role: (s.user as any).role || "" });
    }).catch(() => {});
  }, []);

  const canEdit = (action: ActionDetail) => {
    if (!currentUser) return false;
    if (currentUser.role === "Admin") return true;
    if (action.actionParty && action.actionParty.toLowerCase() === currentUser.name.toLowerCase()) return true;
    if (action.auditee && action.auditee.toLowerCase() === currentUser.name.toLowerCase()) return true;
    return false;
  };

  const openDetail = async (id: string) => {
    setLoadingDetail(true); setSelectedAction(null); setEditMode(false); setModalMsg(null);
    try {
      const res = await fetch(`/api/admin/actions/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      const detail = await res.json();
      setSelectedAction(detail);
      setEditForm(detail);
    } catch (e: any) {
      setModalMsg({ type: "err", text: e.message });
    } finally { setLoadingDetail(false); }
  };

  // Sort actions
  const sorted = [...actions].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Column resize handlers
  const onResizeStart = useCallback((field: SortField, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing({ field, startX: e.clientX, startWidth: colWidths[field] });
  }, [colWidths]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + delta);
      setColWidths(prev => ({ ...prev, [resizing.field]: newWidth }));
    };
    const onUp = () => setResizing(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return " ⇅";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const saveAction = async () => {
    if (!selectedAction) return;
    setSaving(true); setModalMsg(null);
    try {
      const res = await fetch(`/api/admin/actions/${selectedAction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      const updated = await res.json();
      setSelectedAction(updated);
      setEditForm(updated);
      setEditMode(false);
      setModalMsg({ type: "ok", text: "Saved." });
    } catch (e: any) {
      setModalMsg({ type: "err", text: e.message });
    } finally { setSaving(false); }
  };

  if (actions.length === 0) return null;

  return (
    <div className="rounded border border-slate-200 bg-white">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800">
          📋 Outstanding Actions ({actions.length})
        </span>
        <span className="text-slate-400 text-xs">{collapsed ? "▶" : "▼"}</span>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto" style={{ userSelect: resizing ? "none" : undefined }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.field}
                    className="relative px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                    style={{ width: colWidths[col.field], minWidth: 60 }}
                    onClick={() => handleSort(col.field)}
                  >
                    {col.label}{sortIcon(col.field)}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                      onMouseDown={(e) => onResizeStart(col.field, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => (
                <tr key={a.actionId} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer" onClick={(e) => { e.stopPropagation(); openDetail(a.id); }}>
                  <td className="px-3 py-1.5 font-mono text-2xs text-blue-600 whitespace-nowrap">
                    {a.actionId || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700 truncate" style={{ maxWidth: colWidths.findingDescription }} title={a.findingDescription}>
                    {a.findingDescription}
                  </td>
                  <td className="px-3 py-1.5 text-slate-700 truncate" style={{ maxWidth: colWidths.actionDescription }} title={a.actionDescription}>
                    {a.actionDescription}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 truncate" style={{ maxWidth: colWidths.actionParty }}>
                    {a.actionParty || "—"}
                  </td>
                  <td className={`px-3 py-1.5 whitespace-nowrap ${a.targetDate && new Date(a.targetDate) < new Date() ? "text-red-600 font-medium" : "text-slate-600"}`}>
                    {formatDate(a.targetDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Action Detail Modal ── */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedAction(null); setEditMode(false); }}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between rounded-t-lg">
              <h3 className="text-sm font-semibold text-slate-800">
                Action {selectedAction.actionId || selectedAction.id.slice(-8)}
              </h3>
              <div className="flex items-center gap-2">
                {canEdit(selectedAction) && !editMode && (
                  <button onClick={() => setEditMode(true)} className="text-xs text-blue-600 hover:underline">✏️ Edit</button>
                )}
                <button onClick={() => { setSelectedAction(null); setEditMode(false); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {modalMsg && (
                <div className={`rounded px-3 py-2 text-xs ${modalMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{modalMsg.text}</div>
              )}

              {/* ── Finding Details ── */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Finding</h4>
                <div className="bg-slate-50 rounded p-3 space-y-2 text-xs">
                  <div><span className="text-slate-400">Description:</span> <span className="text-slate-700">{selectedAction.finding.description}</span></div>
                  {selectedAction.finding.details && <div><span className="text-slate-400">Details:</span> <span className="text-slate-700">{selectedAction.finding.details}</span></div>}
                  <div className="flex gap-4">
                    <span><span className="text-slate-400">Severity:</span> <span className="font-medium">{selectedAction.finding.severity}</span></span>
                    {selectedAction.finding.assessment && <span><span className="text-slate-400">Assessment:</span> {selectedAction.finding.assessment.name}</span>}
                  </div>
                  {selectedAction.finding.risks && <div><span className="text-slate-400">Risks:</span> <span className="text-slate-700">{selectedAction.finding.risks}</span></div>}
                </div>
              </div>

              {/* ── Action Details ── */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Action</h4>
                {editMode ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs text-slate-500">Description *</span>
                      <textarea value={editForm.actionDescription || ""} onChange={e => setEditForm(f => ({ ...f, actionDescription: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Details</span>
                      <textarea value={editForm.actionDetails || ""} onChange={e => setEditForm(f => ({ ...f, actionDetails: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Action Taken</span>
                      <textarea value={editForm.actionTaken || ""} onChange={e => setEditForm(f => ({ ...f, actionTaken: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" rows={2} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-slate-500">Action Party</span>
                        <input value={editForm.actionParty || ""} onChange={e => setEditForm(f => ({ ...f, actionParty: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-500">Auditee</span>
                        <input value={editForm.auditee || ""} onChange={e => setEditForm(f => ({ ...f, auditee: e.target.value }))}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-500">Target Date</span>
                        <input type="date" value={editForm.targetDate ? editForm.targetDate.slice(0, 10) : ""} onChange={e => setEditForm(f => ({ ...f, targetDate: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-500">Extensions</span>
                        <input value={editForm.numberOfExtensions ?? 0} disabled
                          className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-400" />
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={editForm.apAgreed || false} onChange={e => setEditForm(f => ({ ...f, apAgreed: e.target.checked }))} />
                        AP Agreed
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={editForm.actionClosureEffective || false} onChange={e => setEditForm(f => ({ ...f, actionClosureEffective: e.target.checked }))} />
                        Closure Effective
                      </label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveAction} disabled={saving} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? "Saving…" : "💾 Save"}
                      </button>
                      <button onClick={() => { setEditMode(false); setEditForm(selectedAction); }} className="rounded border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded p-3 space-y-2 text-xs">
                    <div><span className="text-slate-400">Description:</span> <span className="text-slate-700">{selectedAction.actionDescription}</span></div>
                    {selectedAction.actionDetails && <div><span className="text-slate-400">Details:</span> <span className="text-slate-700">{selectedAction.actionDetails}</span></div>}
                    {selectedAction.actionTaken && <div><span className="text-slate-400">Action Taken:</span> <span className="text-slate-700">{selectedAction.actionTaken}</span></div>}
                    <div className="flex gap-4 flex-wrap">
                      <span><span className="text-slate-400">Party:</span> {selectedAction.actionParty || "—"}</span>
                      <span><span className="text-slate-400">Auditee:</span> {selectedAction.auditee || "—"}</span>
                      <span><span className="text-slate-400">Target:</span> {formatDate(selectedAction.targetDate)}</span>
                      <span><span className="text-slate-400">Extensions:</span> {selectedAction.numberOfExtensions}</span>
                    </div>
                    <div className="flex gap-4">
                      <span><span className="text-slate-400">AP Agreed:</span> {selectedAction.apAgreed ? "✅" : "❌"}</span>
                      <span><span className="text-slate-400">Closure:</span> {selectedAction.actionClosureEffective ? "✅ Effective" : "⏳ Open"}</span>
                      {selectedAction.actionClosureApprovedBy && <span><span className="text-slate-400">Approved by:</span> {selectedAction.actionClosureApprovedBy}</span>}
                    </div>
                    <div className="text-2xs text-slate-400">Created: {formatDate(selectedAction.createdDate)} · ID: {selectedAction.id}</div>
                  </div>
                )}
              </div>

              {/* ── Attachments ── */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attachments</h4>
                <AttachmentList destTable="Action" recId={selectedAction.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
