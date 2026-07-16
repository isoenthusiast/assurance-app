"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface OutstandingAction {
  actionId: string | null;
  actionDescription: string;
  actionParty: string | null;
  targetDate: string | null;
  findingDescription: string;
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
                <tr key={a.actionId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono text-2xs text-slate-500 whitespace-nowrap">
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
    </div>
  );
}
