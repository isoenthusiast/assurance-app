"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface TableInfo { table_name: string; row_estimate: number; }
interface Column { name: string; type: string; }

export default function AdminDashboard() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"data" | "columns">("data");

  const loadTables = useCallback(async () => {
    const res = await fetch("/api/admin/tables");
    if (res.ok) { const d = await res.json(); setTables(d.tables || []); }
  }, []);
  useEffect(() => { loadTables(); }, [loadTables]);

  const loadData = useCallback(async (tn: string, pg = 1, pp = 50) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/table/${tn}/data?page=${pg}&perPage=${pp}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setColumns(d.columns || []); setRows(d.rows || []);
      setTotalRows(d.totalRows); setPage(d.page); setPerPage(d.perPage); setTotalPages(d.totalPages);
    } catch (e: any) { setError(e.message); setRows([]); setColumns([]); }
    finally { setLoading(false); }
  }, []);

  const selectTable = (name: string) => { setSelectedTable(name); setPage(1); loadData(name, 1, perPage); };
  const goPage = (pg: number) => { if (!selectedTable || pg < 1 || pg > totalPages) return; loadData(selectedTable, pg, perPage); };

  const dropTable = async (name: string) => {
    if (!confirm(`Drop "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: name, action: "drop" }) });
    if (res.ok) { setSelectedTable(null); loadTables(); } else { const e = await res.json(); alert(e.error); }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-3">
      {/* LEFT: Nav + Table List */}
      <div className="w-56 flex-shrink-0 rounded-lg border border-slate-200 bg-white flex flex-col">
        {/* Navigation Menu */}
        <div className="px-3 py-2.5 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Admin Menu</div>
          <div className="space-y-1">
            <Link href="/setup/badges" className="block px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700">🏆 Badge Management</Link>
            <Link href="/admin/templates" className="block px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700">📋 Assessment Templates</Link>
            <div className="block px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 cursor-pointer" onClick={() => selectTable("User")}>👤 User Management</div>
          </div>
        </div>

        {/* Table List */}
        <div className="px-3 py-2.5 border-b border-slate-200 font-semibold text-xs text-slate-600 flex justify-between items-center">
          Tables ({tables.length})
          <button onClick={loadTables} className="text-blue-600 hover:underline text-xs">↻</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tables.map((t) => (
            <button key={t.table_name} onClick={() => selectTable(t.table_name)}
              className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 hover:bg-slate-50 flex justify-between ${selectedTable === t.table_name ? "bg-blue-50 border-l-2 border-l-blue-500 font-medium" : ""}`}>
              <span className="truncate">{t.table_name}</span>
              <span className="text-slate-400 ml-1">{t.row_estimate}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Detail */}
      <div className="flex-1 rounded-lg border border-slate-200 bg-white flex flex-col min-w-0">
        {!selectedTable ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">← Select a table</div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-sm">{selectedTable}</span>
                <span className="text-xs text-slate-400 ml-3">{totalRows} rows · {columns.length} cols</span>
              </div>
              <button onClick={() => dropTable(selectedTable)} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Drop</button>
            </div>
            <div className="flex border-b border-slate-200 px-4">
              {(["data","columns"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 ${tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500"}`}>
                  {t === "data" ? "Data" : "Columns"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto">
              {error && <div className="m-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
              {tab === "data" && (
                loading ? <div className="p-4 text-xs text-slate-400">Loading...</div>
                : rows.length === 0 ? <div className="p-4 text-xs text-slate-400">No rows.</div>
                : <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-xs">
                      <div className="flex items-center gap-2">
                        <span>{totalRows} rows</span>
                        <select value={perPage} onChange={(e) => { const pp = +e.target.value; setPerPage(pp); if (selectedTable) loadData(selectedTable, 1, pp); }} className="border rounded px-1.5 py-0.5 text-xs">
                          {[10,25,50,100,500].map(n => <option key={n} value={n}>{n}/pg</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => goPage(1)} disabled={page<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">«</button>
                        <button onClick={() => goPage(page-1)} disabled={page<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">‹</button>
                        <span className="px-1.5 text-xs">{page}/{totalPages||1}</span>
                        <button onClick={() => goPage(page+1)} disabled={page>=totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">›</button>
                        <button onClick={() => goPage(totalPages)} disabled={page>=totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">»</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-2xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                          <tr>{columns.map(c => <th key={c.name} className="px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap border-b border-slate-200">{c.name}<span className="ml-1 text-slate-400 font-normal text-2xs">{c.type}</span></th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                              {columns.map(c => (
                                <td key={c.name} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate text-slate-700 text-2xs">
                                  {row[c.name] === null ? <span className="text-slate-300 italic">null</span>
                                    : typeof row[c.name] === "boolean" ? (row[c.name] ? "✓" : "✗")
                                    : typeof row[c.name] === "object" ? JSON.stringify(row[c.name]).slice(0,60)
                                    : String(row[c.name])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              )}
              {tab === "columns" && (
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100"><tr><th className="px-3 py-2 text-left font-medium text-slate-600">Column</th><th className="px-3 py-2 text-left font-medium text-slate-600">Type</th></tr></thead>
                    <tbody>{columns.map(c => <tr key={c.name} className="border-b border-slate-100"><td className="px-3 py-2 font-mono text-xs">{c.name}</td><td className="px-3 py-2 text-xs text-slate-500">{c.type}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
