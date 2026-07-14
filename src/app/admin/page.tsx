"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { KnowledgebaseManager } from "./knowledgebase/page";
import { DocumentControlsManager } from "./document-controls/page";

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
  const [view, setView] = useState<"tables" | "badges" | "templates" | "users" | "knowledgebase" | "documentControls" | "requirements">("tables");

  // Generic table edit state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Record<string, any> | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, any> | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const [rowMsg, setRowMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Assessment delete confirmation state
  const [deleteAssessmentTarget, setDeleteAssessmentTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteAssessmentDeleting, setDeleteAssessmentDeleting] = useState(false);
  const [deleteAssessmentError, setDeleteAssessmentError] = useState<string | null>(null);

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

  const selectTable = (name: string) => { setView("tables"); setSelectedTable(name); setPage(1); loadData(name, 1, perPage); };
  const goPage = (pg: number) => { if (!selectedTable || pg < 1 || pg > totalPages) return; loadData(selectedTable, pg, perPage); };

  const dropTable = async (name: string) => {
    if (!confirm(`Drop "${name}"? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: name, action: "drop" }) });
    if (res.ok) { setSelectedTable(null); loadTables(); } else { const e = await res.json(); alert(e.error); }
  };

  // ── Generic row CRUD ──────────────────────────────────────────────
  const getPkField = (table: string) => table === "Requirement" ? "rId" : "id";
  const getPkValue = (row: any, table: string) => {
    const pk = getPkField(table);
    return row[pk] ?? row[pk === "rId" ? "rID" : ""];
  };

  const startEditRow = (idx: number) => {
    setEditingIdx(idx);
    setEditRow({ ...rows[idx] });
    setAddingRow(false);
    setRowMsg(null);
  };

  const cancelEdit = () => {
    setEditingIdx(null); setEditRow(null); setAddingRow(false); setNewRow(null); setRowMsg(null);
  };

  const saveEditRow = async () => {
    if (!selectedTable || editingIdx === null || !editRow) return;
    setSavingRow(true); setRowMsg(null);
    try {
      const pk = getPkField(selectedTable);
      const pkVal = editRow[pk] ?? editRow[pk === "rId" ? "rID" : ""];
      const res = await fetch(`/api/admin/table/${selectedTable}/${pkVal}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRow),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setRowMsg({ type: "ok", text: "Saved." });
      setEditingIdx(null); setEditRow(null);
      if (selectedTable) loadData(selectedTable, page, perPage);
    } catch (e: any) { setRowMsg({ type: "err", text: e.message }); }
    finally { setSavingRow(false); }
  };

  const deleteRow = async (idx: number) => {
    if (!selectedTable) return;
    const row = rows[idx];
    const pk = getPkField(selectedTable);
    const pkVal = row[pk] ?? row[pk === "rId" ? "rID" : ""];

    // Assessment: show detailed confirmation modal
    if (selectedTable === "Assessment") {
      setDeleteAssessmentTarget({ id: pkVal as string, name: (row.name || row.id || pkVal) as string });
      return;
    }

    if (!confirm(`Delete row with ${pk}=${pkVal}?`)) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/${pkVal}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Delete failed"); return; }
      if (selectedTable) loadData(selectedTable, page, perPage);
    } catch (e: any) { alert(e.message); }
  };

  const confirmDeleteAssessment = async () => {
    if (!deleteAssessmentTarget) return;
    setDeleteAssessmentDeleting(true);
    setDeleteAssessmentError(null);
    try {
      const res = await fetch(`/api/admin/table/Assessment/${deleteAssessmentTarget.id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); setDeleteAssessmentError(e.error || "Delete failed"); return; }
      setDeleteAssessmentTarget(null);
      if (selectedTable) loadData(selectedTable, page, perPage);
    } catch (e: any) { setDeleteAssessmentError(e.message); }
    finally { setDeleteAssessmentDeleting(false); }
  };

  const startAddRow = () => {
    const empty: Record<string, any> = {};
    columns.forEach(c => {
      if (c.name === "createdAt") empty[c.name] = new Date().toISOString();
      else if (c.type === "Boolean") empty[c.name] = true;
      else if (c.type === "Int" || c.type === "Float") empty[c.name] = 0;
      else empty[c.name] = "";
    });
    setNewRow(empty);
    setAddingRow(true);
    setEditingIdx(null);
    setRowMsg(null);
  };

  const saveAddRow = async () => {
    if (!selectedTable || !newRow) return;
    setSavingRow(true); setRowMsg(null);
    try {
      const body = { ...newRow };
      if (!body.id && getPkField(selectedTable) === "id") body.id = `id_${Date.now()}`;
      const res = await fetch(`/api/admin/table/${selectedTable}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Add failed");
      setRowMsg({ type: "ok", text: "Row added." });
      setAddingRow(false); setNewRow(null);
      if (selectedTable) loadData(selectedTable, page, perPage);
    } catch (e: any) { setRowMsg({ type: "err", text: e.message }); }
    finally { setSavingRow(false); }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-3">
      {/* LEFT: Nav + Table List */}
      <div className="w-56 flex-shrink-0 rounded-lg border border-slate-200 bg-white flex flex-col">
        {/* Navigation Menu */}
        <div className="px-3 py-2.5 border-b border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Admin Menu</div>
          <div className="space-y-1">
            <button onClick={() => setView("badges")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "badges" ? "bg-blue-50 font-medium" : ""}`}>🏆 Badge Management</button>
            <button onClick={() => setView("templates")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "templates" ? "bg-blue-50 font-medium" : ""}`}>📋 Assessment Templates</button>
            <button onClick={() => setView("users")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "users" ? "bg-blue-50 font-medium" : ""}`}>👤 User Management</button>
            <button onClick={() => setView("knowledgebase")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "knowledgebase" ? "bg-blue-50 font-medium" : ""}`}>📚 Knowledgebase</button>
            <button onClick={() => setView("documentControls")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "documentControls" ? "bg-blue-50 font-medium" : ""}`}>📄 Document Controls</button>
            <button onClick={() => setView("requirements")} className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-slate-100 text-slate-700 ${view === "requirements" ? "bg-blue-50 font-medium" : ""}`}>📋 Requirements</button>
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
        {view === "badges" ? (
          <iframe src="/setup/badges" className="w-full h-full border-0" title="Badge Management" />
        ) : view === "templates" ? (
          <iframe src="/admin/templates" className="w-full h-full border-0" title="Assessment Templates" />
        ) : view === "users" ? (
          <UserManager />
        ) : view === "knowledgebase" ? (
          <KnowledgebaseManager />
        ) : view === "documentControls" ? (
          <DocumentControlsManager />
        ) : view === "requirements" ? (
          <RequirementManager />
        ) : !selectedTable ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">← Select a table</div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-sm">{selectedTable}</span>
                <span className="text-xs text-slate-400 ml-3">{totalRows} rows · {columns.length} cols</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={startAddRow} className="rounded bg-green-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-green-700">＋ Add Row</button>
                <button onClick={() => dropTable(selectedTable!)} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Drop</button>
              </div>
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
                      {rowMsg && (
                        <div className={`mx-3 mt-2 rounded px-3 py-1.5 text-xs ${rowMsg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{rowMsg.text}</div>
                      )}
                      {/* Add new row form */}
                      {addingRow && newRow && (
                        <div className="mx-3 mt-2 mb-2 rounded border border-blue-200 bg-blue-50/30 p-2">
                          <div className="text-xs font-medium text-blue-700 mb-2">New Row — {selectedTable}</div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                            {columns.filter(c => c.name !== "createdAt").slice(0, 8).map(c => (
                              <label key={c.name} className="block">
                                <span className="text-2xs text-slate-500">{c.name}</span>
                                {c.type === "Boolean" ? (
                                  <select value={newRow[c.name] ? "true" : "false"} onChange={e => setNewRow(r => ({ ...r!, [c.name]: e.target.value === "true" }))}
                                    className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5 text-2xs bg-white">
                                    <option value="true">✓ true</option><option value="false">✗ false</option>
                                  </select>
                                ) : (
                                  <input value={String(newRow[c.name] ?? "")} onChange={e => setNewRow(r => ({ ...r!, [c.name]: e.target.value }))}
                                    className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5 text-2xs font-mono" />
                                )}
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={saveAddRow} disabled={savingRow} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-400">{savingRow ? "Saving..." : "Save"}</button>
                            <button onClick={cancelEdit} className="rounded border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                          </div>
                        </div>
                      )}
                      <table className="w-full text-2xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100 z-10">
                          <tr>
                            {columns.map(c => <th key={c.name} className="px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap border-b border-slate-200">{c.name}<span className="ml-1 text-slate-400 font-normal text-2xs">{c.type}</span></th>)}
                            <th className="px-2 py-1.5 text-left font-medium text-slate-600 whitespace-nowrap border-b border-slate-200 w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const isEditing = editingIdx === i;
                            return (
                            <tr key={i} className={`border-b border-slate-100 ${isEditing ? "bg-yellow-50" : "hover:bg-slate-50"}`}>
                              {isEditing && editRow ? (
                                <>
                                  {columns.map(c => (
                                    <td key={c.name} className="px-1 py-0.5">
                                      {c.type === "Boolean" ? (
                                        <select value={editRow[c.name] ? "true" : "false"} onChange={e => setEditRow(r => ({ ...r!, [c.name]: e.target.value === "true" }))}
                                          className="w-full rounded border border-blue-300 px-1 py-0.5 text-2xs bg-white">
                                          <option value="true">✓</option><option value="false">✗</option>
                                        </select>
                                      ) : c.name === "id" || c.name === "rId" || c.name === "rID" || c.name === "createdAt" ? (
                                        <span className="px-1 text-slate-400">{String(row[c.name] ?? "")}</span>
                                      ) : (
                                        <input value={String(editRow[c.name] ?? "")} onChange={e => setEditRow(r => ({ ...r!, [c.name]: e.target.value }))}
                                          className="w-full rounded border border-blue-300 px-1 py-0.5 text-2xs font-mono" />
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-1 py-0.5 whitespace-nowrap">
                                    <button onClick={saveEditRow} disabled={savingRow} className="text-green-600 hover:underline text-2xs mr-1">✓</button>
                                    <button onClick={cancelEdit} className="text-red-500 hover:underline text-2xs">✗</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  {columns.map(c => (
                                    <td key={c.name} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate text-slate-700 text-2xs">
                                      {row[c.name] === null ? <span className="text-slate-300 italic">null</span>
                                        : typeof row[c.name] === "boolean" ? (row[c.name] ? "✓" : "✗")
                                        : typeof row[c.name] === "object" ? JSON.stringify(row[c.name]).slice(0, 60)
                                        : String(row[c.name])}
                                    </td>
                                  ))}
                                  <td className="px-1 py-0.5 whitespace-nowrap">
                                    <button onClick={() => startEditRow(i)} className="text-blue-600 hover:underline text-2xs mr-1.5">Edit</button>
                                    <button onClick={() => deleteRow(i)} className="text-red-500 hover:underline text-2xs">Del</button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );})}
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

// ─── User Manager ──────────────────────────────────────────────────────────

function UserManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [mode, setMode] = useState<"select" | "add" | "manageRoles" | "manageCompany">("select");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0, position: "", companyId: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/table/User/data?perPage=500")
      .then(r => r.json()).then(d => setUsers(d.rows || []));
    fetch("/api/admin/table/Company/data?perPage=500")
      .then(r => r.json()).then(d => setCompanies(d.rows || []));
  }, []);

  useEffect(() => {
    if (mode === "add") { setForm({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0, position: "", companyId: "" }); return; }
    if (!selectedUserId) { setForm({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0, position: "", companyId: "" }); return; }
    const u = users.find((u: any) => u.id === selectedUserId);
    if (u) setForm({ name: u.name || "", username: u.username || "", role: u.role || "Assessor", password: "", totalPoints: u.totalPoints || 0, position: u.position || "", companyId: u.companyId || "" });
  }, [selectedUserId, users, mode]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const body: any = { name: form.name, username: form.username, role: form.role, totalPoints: Number(form.totalPoints), position: form.position, companyId: form.companyId };
      if (form.password) body.password = form.password;

      if (mode === "add") {
        body.id = `user_${Date.now()}`;
        const res = await fetch("/api/admin/table/User", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        setMsg({ type: "ok", text: "User created." });
        setMode("select");
      } else {if (!selectedUserId) return;
        const res = await fetch(`/api/admin/table/User/${selectedUserId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
        setMsg({ type: "ok", text: "User updated." });
      }
      setForm(f => ({ ...f, password: "" }));
      const r = await fetch("/api/admin/table/User/data?perPage=500");
      setUsers((await r.json()).rows || []);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  const filtered = users.filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200">
        <span className="font-semibold text-slate-900 text-sm">👤 User Management</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left: User Menu + List */}
        <div className="w-52 border-r border-slate-200 flex flex-col">
          <div className="p-2 border-b border-slate-100 space-y-1">
            <button onClick={() => { setMode("add"); setSelectedUserId(""); }}
              className={`block w-full text-left px-2 py-1 text-xs rounded ${mode === "add" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>＋ Add User</button>
            <button onClick={() => setMode("manageRoles")}
              className={`block w-full text-left px-2 py-1 text-xs rounded ${mode === "manageRoles" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>👥 Manage Roles</button>
            <button onClick={() => setMode("manageCompany")}
              className={`block w-full text-left px-2 py-1 text-xs rounded ${mode === "manageCompany" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>🏢 Manage Company</button>
            <button onClick={() => setMode("select")}
              className={`block w-full text-left px-2 py-1 text-xs rounded ${mode === "select" ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>🔍 Select User</button>
          </div>
          {mode === "select" && (
            <>
              <div className="px-2 py-1.5">
                <input placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map((u: any) => (
                  <button key={u.id} onClick={() => { setSelectedUserId(u.id); setMode("select"); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${selectedUserId === u.id && mode === "select" ? "bg-blue-50 font-medium" : "text-slate-700"}`}>
                    <div>{u.name || u.username}</div>
                    <div className="text-2xs text-slate-400">{u.role}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          {mode === "select" && !selectedUserId ? (
            <div className="text-slate-400 text-sm">← Search and select a user, or click Add User</div>
          ) : mode === "manageRoles" ? (
            <ManageRoles users={users} />
          ) : mode === "manageCompany" ? (
            <ManageCompany users={users} />
          ) : (
            <div className="max-w-md">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">{mode === "add" ? "Add New User" : "Edit User"}</h3>
              {msg && (
                <div className={`mb-4 rounded px-3 py-2 text-xs ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.text}</div>
              )}
              <div className="space-y-3">
                <label className="block"><span className="text-xs text-slate-500">Name</span>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Username</span>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Password {mode === "select" && "(leave blank to keep current)"}</span>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
                  <span className="text-2xs text-slate-400">Hashed with bcrypt before storage</span>
                </label>
                <label className="block"><span className="text-xs text-slate-500">Role</span>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
                    <option value="Assessor">Assessor</option><option value="Admin">Admin</option>
                  </select>
                </label>
                <label className="block"><span className="text-xs text-slate-500">Position (Job Title)</span>
                  <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" placeholder="e.g. Senior HSSE Engineer" />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Company</span>
                  <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">
                    <option value="">— Select Company —</option>
                    {companies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.companyName}{c.shortName ? ` (${c.shortName})` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="block"><span className="text-xs text-slate-500">Total Points</span>
                  <input type="number" value={form.totalPoints} onChange={e => setForm(f => ({ ...f, totalPoints: Number(e.target.value) }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
                </label>
                <button onClick={handleSave} disabled={saving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400">
                  {saving ? "Saving..." : mode === "add" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manage Roles ──────────────────────────────────────────────────────────

function ManageRoles({ users }: { users: any[] }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePerPage, setRolePerPage] = useState(5);
  const [roleTotalRows, setRoleTotalRows] = useState(0);
  const [roleTotalPages, setRoleTotalPages] = useState(1);
  const [mapPage, setMapPage] = useState(1);
  const [mapPerPage, setMapPerPage] = useState(5);
  const [mapTotalRows, setMapTotalRows] = useState(0);
  const [mapTotalPages, setMapTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ uRoleName: "", uRoleDescription: "", uRolePositions: "", uRoleReportingLine: "" });
  const [mapRemarks, setMapRemarks] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [roleSubmode, setRoleSubmode] = useState<"select" | "add">("select");

  const loadRoles = useCallback(async (pg = 1, pp = 5) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/table/UserRole/data?page=${pg}&perPage=${pp}`);
      const d = await res.json();
      setRoles(d.rows || []);
      setRoleTotalRows(d.totalRows);
      setRoleTotalPages(d.totalPages);
      setRolePage(d.page);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadMappings = useCallback(async (pg = 1, pp = 5) => {
    try {
      const res = await fetch(`/api/admin/table/UserRoleMapping/data?page=${pg}&perPage=${pp}`);
      const d = await res.json();
      setMappings(d.rows || []);
      setMapTotalRows(d.totalRows);
      setMapTotalPages(d.totalPages);
      setMapPage(d.page);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadRoles(); loadMappings(); }, [loadRoles, loadMappings]);

  useEffect(() => {
    if (selectedRoleId) {
      const r = roles.find((r: any) => r.id === selectedRoleId);
      if (r) setForm({ uRoleName: r.uRoleName || "", uRoleDescription: r.uRoleDescription || "", uRolePositions: r.uRolePositions || "", uRoleReportingLine: r.uRoleReportingLine || "" });
    } else {
      setForm({ uRoleName: "", uRoleDescription: "", uRolePositions: "", uRoleReportingLine: "" });
    }
  }, [selectedRoleId, roles]);

  const saveRole = async () => {
    setMsg(null);
    try {
      const body: any = { uRoleName: form.uRoleName, uRoleDescription: form.uRoleDescription, uRolePositions: form.uRolePositions, uRoleReportingLine: form.uRoleReportingLine };
      let res: Response;
      if (roleSubmode === "add") {
        body.id = `role_${Date.now()}`;
        res = await fetch("/api/admin/table/UserRole", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        if (!selectedRoleId) return;
        res = await fetch(`/api/admin/table/UserRole/${selectedRoleId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setMsg({ type: "ok", text: roleSubmode === "add" ? "Role created." : "Role updated." });
      if (roleSubmode === "add") { setRoleSubmode("select"); setSelectedRoleId(""); setForm({ uRoleName: "", uRoleDescription: "", uRolePositions: "", uRoleReportingLine: "" }); }
      loadRoles(rolePage, rolePerPage);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
  };

  const addMapping = async () => {
    if (!selectedUserId || !selectedRoleId) { setMsg({ type: "err", text: "Select both a user and a role." }); return; }
    setMsg(null);
    try {
      const res = await fetch("/api/admin/table/UserRoleMapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `map_${Date.now()}`, userId: selectedUserId, userRoleId: selectedRoleId, remarks: mapRemarks }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setMsg({ type: "ok", text: "Role assigned to user." });
      setMapRemarks("");
      loadMappings(mapPage, mapPerPage);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
  };

  const deleteMapping = async (mapId: string) => {
    if (!confirm("Remove this role mapping?")) return;
    try {
      await fetch(`/api/admin/table/UserRoleMapping/${mapId}`, { method: "DELETE" });
      loadMappings(mapPage, mapPerPage);
    } catch { /* ignore */ }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm("Delete this role? This will remove all user mappings for this role.")) return;
    try {
      await fetch(`/api/admin/table/UserRole/${roleId}`, { method: "DELETE" });
      if (selectedRoleId === roleId) { setSelectedRoleId(""); setForm({ uRoleName: "", uRoleDescription: "", uRolePositions: "", uRoleReportingLine: "" }); }
      loadRoles(rolePage, rolePerPage);
      loadMappings(mapPage, mapPerPage);
    } catch { /* ignore */ }
  };

  const getUserName = (uid: string) => {
    const u = users.find((u: any) => u.id === uid);
    return u ? u.name || u.username : uid;
  };
  const getRoleName = (rid: string) => {
    const r = roles.find((r: any) => r.id === rid);
    return r ? r.uRoleName : rid;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 font-semibold text-slate-900 text-sm">👥 Manage Roles</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {msg && (
          <div className={`rounded px-3 py-2 text-xs ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.text}</div>
        )}

        {/* ─── Role Definitions ─── */}
        <div className="rounded border border-slate-200">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Role Definitions</span>
            <div className="flex items-center gap-2">
              <select value={rolePerPage} onChange={(e) => { const pp = +e.target.value; setRolePerPage(pp); loadRoles(1, pp); }}
                className="border rounded px-1.5 py-0.5 text-xs">
                {[5,10,25,50].map(n => <option key={n} value={n}>{n}/pg</option>)}
              </select>
              <button onClick={() => { setRoleSubmode("add"); setSelectedRoleId(""); }}
                className="text-xs text-blue-600 hover:underline">＋ Add Role</button>
            </div>
          </div>
          {loading ? <div className="p-3 text-xs text-slate-400">Loading...</div>
          : roles.length === 0 ? <div className="p-3 text-xs text-slate-400">No roles defined.</div>
          : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600 w-8">#</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Role Name</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Positions</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Reporting Line</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r: any, i: number) => (
                  <tr key={r.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selectedRoleId === r.id ? "bg-blue-50" : ""}`}>
                    <td className="px-2 py-1 text-slate-400">{((rolePage - 1) * rolePerPage) + i + 1}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => { setSelectedRoleId(r.id); setRoleSubmode("select"); }}
                        className="text-blue-600 hover:underline font-medium">{r.uRoleName}</button>
                      {r.uRoleDescription && <div className="text-2xs text-slate-400">{r.uRoleDescription}</div>}
                    </td>
                    <td className="px-2 py-1 text-slate-600">{r.uRolePositions || "—"}</td>
                    <td className="px-2 py-1 text-slate-600">{r.uRoleReportingLine || "—"}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => deleteRole(r.id)} className="text-red-500 hover:underline text-2xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {roleTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-xs">
              <span className="text-slate-400">{roleTotalRows} roles</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => loadRoles(1, rolePerPage)} disabled={rolePage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">«</button>
                <button onClick={() => loadRoles(rolePage-1, rolePerPage)} disabled={rolePage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">‹</button>
                <span className="px-1.5">{rolePage}/{roleTotalPages||1}</span>
                <button onClick={() => loadRoles(rolePage+1, rolePerPage)} disabled={rolePage>=roleTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">›</button>
                <button onClick={() => loadRoles(roleTotalPages, rolePerPage)} disabled={rolePage>=roleTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">»</button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Role Editor ─── */}
        {(selectedRoleId || roleSubmode === "add") && (
          <div className="rounded border border-slate-200">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
              {roleSubmode === "add" ? "New Role" : `Edit: ${form.uRoleName}`}
            </div>
            <div className="p-3 space-y-2">
              <label className="block"><span className="text-xs text-slate-500">Role Name</span>
                <input value={form.uRoleName} onChange={e => setForm(f => ({ ...f, uRoleName: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. HSSE Lead Assessor" />
              </label>
              <label className="block"><span className="text-xs text-slate-500">Description</span>
                <input value={form.uRoleDescription} onChange={e => setForm(f => ({ ...f, uRoleDescription: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="What this role does in the app" />
              </label>
              <label className="block"><span className="text-xs text-slate-500">Positions (comma-separated job titles)</span>
                <input value={form.uRolePositions} onChange={e => setForm(f => ({ ...f, uRolePositions: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. Senior HSSE Engineer, HSSE Manager" />
              </label>
              <label className="block"><span className="text-xs text-slate-500">Reporting Line</span>
                <input value={form.uRoleReportingLine} onChange={e => setForm(f => ({ ...f, uRoleReportingLine: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. Reports to HSSE Director" />
              </label>
              <div className="flex gap-2">
                <button onClick={saveRole} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
                  {roleSubmode === "add" ? "Create Role" : "Save Changes"}
                </button>
                {roleSubmode === "select" && (
                  <button onClick={() => { setSelectedRoleId(""); setForm({ uRoleName: "", uRoleDescription: "", uRolePositions: "", uRoleReportingLine: "" }); }}
                    className="rounded border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── User-Role Mapping ─── */}
        <div className="rounded border border-slate-200">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">User ↔ Role Assignments</span>
            <select value={mapPerPage} onChange={(e) => { const pp = +e.target.value; setMapPerPage(pp); loadMappings(1, pp); }}
              className="border rounded px-1.5 py-0.5 text-xs">
              {[5,10,25,50].map(n => <option key={n} value={n}>{n}/pg</option>)}
            </select>
          </div>
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-end gap-2 flex-wrap">
              <label className="block flex-1 min-w-[150px]">
                <span className="text-xs text-slate-500">User</span>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select User —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username} ({u.position || u.role})</option>)}
                </select>
              </label>
              <label className="block flex-1 min-w-[150px]">
                <span className="text-xs text-slate-500">Role</span>
                <select value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select Role —</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.uRoleName}</option>)}
                </select>
              </label>
              <label className="block flex-1 min-w-[120px]">
                <span className="text-xs text-slate-500">Remarks</span>
                <input value={mapRemarks} onChange={e => setMapRemarks(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Optional" />
              </label>
              <button onClick={addMapping} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 h-[30px]">＋ Assign</button>
            </div>
          </div>
          {mappings.length === 0 ? (
            <div className="p-3 text-xs text-slate-400">No role assignments yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">User</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Role</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Remarks</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Assigned</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m: any) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1">{getUserName(m.userId)}</td>
                    <td className="px-2 py-1 font-medium">{getRoleName(m.userRoleId)}</td>
                    <td className="px-2 py-1 text-slate-500">{m.remarks || "—"}</td>
                    <td className="px-2 py-1 text-slate-400 text-2xs">{m.createdDate ? new Date(m.createdDate).toLocaleDateString() : "—"}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => deleteMapping(m.id)} className="text-red-500 hover:underline text-2xs">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {mapTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-xs">
              <span className="text-slate-400">{mapTotalRows} assignments</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => loadMappings(1, mapPerPage)} disabled={mapPage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">«</button>
                <button onClick={() => loadMappings(mapPage-1, mapPerPage)} disabled={mapPage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">‹</button>
                <span className="px-1.5">{mapPage}/{mapTotalPages||1}</span>
                <button onClick={() => loadMappings(mapPage+1, mapPerPage)} disabled={mapPage>=mapTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">›</button>
                <button onClick={() => loadMappings(mapTotalPages, mapPerPage)} disabled={mapPage>=mapTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manage Company ────────────────────────────────────────────────────────

function ManageCompany({ users }: { users: any[] }) {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [assignCompanyId, setAssignCompanyId] = useState<string>("");
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPerPage, setCompanyPerPage] = useState(5);
  const [companyTotalRows, setCompanyTotalRows] = useState(0);
  const [companyTotalPages, setCompanyTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ companyID: "", companyName: "", referenceID: "", shortName: "" });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submode, setSubmode] = useState<"select" | "add">("select");
  // UserCompany assignments for selected company
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const loadCompanies = useCallback(async (pg = 1, pp = 5) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/table/Company/data?page=${pg}&perPage=${pp}`);
      const d = await res.json();
      setCompanies(d.rows || []);
      setCompanyTotalRows(d.totalRows);
      setCompanyTotalPages(d.totalPages);
      setCompanyPage(d.page);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  useEffect(() => {
    if (selectedCompanyId) {
      const c = companies.find((c: any) => c.id === selectedCompanyId);
      if (c) setForm({ companyID: c.companyID || "", companyName: c.companyName || "", referenceID: c.referenceID || "", shortName: c.shortName || "" });
    } else {
      setForm({ companyID: "", companyName: "", referenceID: "", shortName: "" });
    }
  }, [selectedCompanyId, companies]);

  const saveCompany = async () => {
    setMsg(null);
    try {
      const body: any = { companyID: form.companyID, companyName: form.companyName, referenceID: form.referenceID, shortName: form.shortName };
      let res: Response;
      if (submode === "add") {
        body.id = `comp_${Date.now()}`;
        res = await fetch("/api/admin/table/Company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        if (!selectedCompanyId) return;
        res = await fetch(`/api/admin/table/Company/${selectedCompanyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setMsg({ type: "ok", text: submode === "add" ? "Company created." : "Company updated." });
      if (submode === "add") { setSubmode("select"); setSelectedCompanyId(""); setForm({ companyID: "", companyName: "", referenceID: "", shortName: "" }); }
      loadCompanies(companyPage, companyPerPage);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
  };

  // Load ALL UserCompany assignments on mount + refresh
  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const res = await fetch("/api/admin/table/UserCompany/data?perPage=500");
      const d = await res.json();
      setAssignments(d.rows || []);
    } catch { setAssignments([]); }
    finally { setAssignmentsLoading(false); }
  }, []);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const assignUserToCompany = async () => {
    if (!selectedUserId || !assignCompanyId) { setMsg({ type: "err", text: "Select both a user and a company." }); return; }
    setMsg(null);
    try {
      // Insert into UserCompany junction table
      const body = { id: `uc_${Date.now()}`, userId: selectedUserId, companyId: assignCompanyId };
      const res = await fetch("/api/admin/table/UserCompany", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        // If duplicate (already assigned), that's ok
        if (err.error?.includes("duplicate") || err.error?.includes("unique")) {
          setMsg({ type: "ok", text: "User already assigned to this company." });
        } else {
          throw new Error(err.error || "Failed");
        }
      } else {
        setMsg({ type: "ok", text: "User assigned to company." });
      }
      // Refresh assignments list
      loadAssignments();
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this user from the company?")) return;
    try {
      await fetch(`/api/admin/table/UserCompany/${assignmentId}`, { method: "DELETE" });
      loadAssignments();
      setMsg({ type: "ok", text: "Assignment removed." });
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm("Delete this company?")) return;
    try {
      await fetch(`/api/admin/table/Company/${id}`, { method: "DELETE" });
      if (selectedCompanyId === id) { setSelectedCompanyId(""); setForm({ companyID: "", companyName: "", referenceID: "", shortName: "" }); }
      loadCompanies(companyPage, companyPerPage);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-slate-200 font-semibold text-slate-900 text-sm">🏢 Manage Company</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {msg && (
          <div className={`rounded px-3 py-2 text-xs ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.text}</div>
        )}

        {/* ─── Company Definitions ─── */}
        <div className="rounded border border-slate-200">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Companies</span>
            <div className="flex items-center gap-2">
              <select value={companyPerPage} onChange={(e) => { const pp = +e.target.value; setCompanyPerPage(pp); loadCompanies(1, pp); }}
                className="border rounded px-1.5 py-0.5 text-xs">
                {[5,10,25,50].map(n => <option key={n} value={n}>{n}/pg</option>)}
              </select>
              <button onClick={() => { setSubmode("add"); setSelectedCompanyId(""); }}
                className="text-xs text-blue-600 hover:underline">＋ Add Company</button>
            </div>
          </div>
          {loading ? <div className="p-3 text-xs text-slate-400">Loading...</div>
          : companies.length === 0 ? <div className="p-3 text-xs text-slate-400">No companies defined.</div>
          : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600 w-8">#</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Company Name</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">ID</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Short Name</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Reference</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c: any, i: number) => (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selectedCompanyId === c.id ? "bg-blue-50" : ""}`}>
                    <td className="px-2 py-1 text-slate-400">{((companyPage - 1) * companyPerPage) + i + 1}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => { setSelectedCompanyId(c.id); setSubmode("select"); }}
                        className="text-blue-600 hover:underline font-medium">{c.companyName}</button>
                    </td>
                    <td className="px-2 py-1 text-slate-500 font-mono text-2xs">{c.companyID}</td>
                    <td className="px-2 py-1 text-slate-600">{c.shortName || "—"}</td>
                    <td className="px-2 py-1 text-slate-500">{c.referenceID || "—"}</td>
                    <td className="px-2 py-1">
                      <button onClick={() => deleteCompany(c.id)} className="text-red-500 hover:underline text-2xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {companyTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-xs">
              <span className="text-slate-400">{companyTotalRows} companies</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => loadCompanies(1, companyPerPage)} disabled={companyPage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">«</button>
                <button onClick={() => loadCompanies(companyPage-1, companyPerPage)} disabled={companyPage<=1} className="px-1.5 py-0.5 border rounded disabled:opacity-30">‹</button>
                <span className="px-1.5">{companyPage}/{companyTotalPages||1}</span>
                <button onClick={() => loadCompanies(companyPage+1, companyPerPage)} disabled={companyPage>=companyTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">›</button>
                <button onClick={() => loadCompanies(companyTotalPages, companyPerPage)} disabled={companyPage>=companyTotalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30">»</button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Company Editor ─── */}
        {(selectedCompanyId || submode === "add") && (
          <div className="rounded border border-slate-200">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
              {submode === "add" ? "New Company" : `Edit: ${form.companyName}`}
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-slate-500">Company ID</span>
                  <input value={form.companyID} onChange={e => setForm(f => ({ ...f, companyID: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. C001" />
                </label>
                <label className="block"><span className="text-xs text-slate-500">Short Name</span>
                  <input value={form.shortName} onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. SEA" />
                </label>
              </div>
              <label className="block"><span className="text-xs text-slate-500">Company Name</span>
                <input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. Seam Assurance Sdn Bhd" />
              </label>
              <label className="block"><span className="text-xs text-slate-500">Reference ID</span>
                <input value={form.referenceID} onChange={e => setForm(f => ({ ...f, referenceID: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. REF-001" />
              </label>
              <div className="flex gap-2">
                <button onClick={saveCompany} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
                  {submode === "add" ? "Create Company" : "Save Changes"}
                </button>
                {submode === "select" && (
                  <button onClick={() => { setSelectedCompanyId(""); setForm({ companyID: "", companyName: "", referenceID: "", shortName: "" }); }}
                    className="rounded border px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── User-Company Assignment ─── */}
        <div className="rounded border border-slate-200">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700">User ↔ Company Assignment (UserCompany)</span>
          </div>
          <div className="p-3">
            <div className="flex items-end gap-2 flex-wrap">
              <label className="block flex-1 min-w-[180px]">
                <span className="text-xs text-slate-500">User</span>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select User —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                </select>
              </label>
              <label className="block flex-1 min-w-[180px]">
                <span className="text-xs text-slate-500">Company</span>
                <select value={assignCompanyId} onChange={e => setAssignCompanyId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select Company —</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.companyName} ({c.shortName || c.companyID})</option>)}
                </select>
              </label>
              <button onClick={assignUserToCompany} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 h-[30px]">＋ Assign</button>
            </div>

            {/* All assignments table */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-xs font-medium text-slate-600 mb-2">
                All Assignments ({assignments.length})
              </div>
              {assignmentsLoading ? (
                <div className="text-xs text-slate-400">Loading...</div>
              ) : assignments.length === 0 ? (
                <div className="text-xs text-slate-400">No user-company assignments yet.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium text-slate-600">User</th>
                      <th className="px-2 py-1 text-left font-medium text-slate-600">Username</th>
                      <th className="px-2 py-1 text-left font-medium text-slate-600">Company</th>
                      <th className="px-2 py-1 text-left font-medium text-slate-600 w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...assignments].sort((a: any, b: any) => {
                      const nameA = users.find((x: any) => x.id === a.userId)?.name || "";
                      const nameB = users.find((x: any) => x.id === b.userId)?.name || "";
                      return nameA.localeCompare(nameB);
                    }).map((a: any) => {
                      const u = Array.isArray(users) ? users.find((x: any) => x.id === a.userId) : null;
                      const c = Array.isArray(companies) ? companies.find((x: any) => x.id === a.companyId) : null;
                      return (
                        <tr key={a.id} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-700">{u?.name || a.userId}</td>
                          <td className="px-2 py-1 text-slate-500">{u?.username || "—"}</td>
                          <td className="px-2 py-1 text-slate-700">{c?.companyName || c?.companyID || a.companyId}</td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeAssignment(a.id)} className="text-red-500 hover:underline text-2xs">Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* ─── Assessment Delete Confirmation Modal ──────────────────────── */}
      {deleteAssessmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Assessment</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete <strong>&quot;{deleteAssessmentTarget.name}&quot;</strong>?
            </p>
            <p className="text-sm text-red-600 font-medium mb-4">
              This will permanently delete ALL related data:
            </p>
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between border-b border-slate-100 py-1">
                <span className="text-slate-700">Cascade-deleted (automatic):</span>
              </div>
              {["Control Assignments","Samples","Findings → Actions","Assessment Activities (Aact) → AActControls, AActUsers, AActDetails"].map(t => (
                <div key={t} className="flex items-center gap-2 pl-4 text-slate-500"><span className="text-red-400">✕</span> {t}</div>
              ))}
              <div className="flex justify-between border-b border-slate-100 pt-2 py-1">
                <span className="text-slate-700">Also cleaned up:</span>
              </div>
              {["Attachments (linked to this assessment & children)","Knowledge Base mappings"].map(t => (
                <div key={t} className="flex items-center gap-2 pl-4 text-slate-500"><span className="text-amber-400">✕</span> {t}</div>
              ))}
            </div>
            <p className="text-xs text-green-600 mb-4">✅ No master data will be affected (Users, Controls, Standards, Process Areas, etc.)</p>
            {deleteAssessmentError && (
              <p className="text-sm text-red-600 mb-3 bg-red-50 px-3 py-2 rounded">{deleteAssessmentError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setDeleteAssessmentTarget(null); setDeleteAssessmentError(null); }} disabled={deleteAssessmentDeleting} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDeleteAssessment} disabled={deleteAssessmentDeleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{deleteAssessmentDeleting ? "Deleting…" : "Delete Assessment & All Related Data"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Requirement Manager ────────────────────────────────────────────────────

function RequirementManager() {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [processAreas, setProcessAreas] = useState<any[]>([]);
  const [standards, setStandards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree expand/collapse state
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  // Current selection (drives table filter + breadcrumb)
  const [selStandardId, setSelStandardId] = useState<string>("");  // Standard.id
  const [selPAId, setSelPAId] = useState<string>("");              // ProcessArea.id

  // Table pagination
  const [page, setPage] = useState(1);
  const perPage = 25;

  // Expanded requirement for full-form editing
  const [expandedReqId, setExpandedReqId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Associated controls for expanded requirement
  const [allControls, setAllControls] = useState<any[]>([]);
  const [allMappings, setAllMappings] = useState<any[]>([]);
  const controlsLoadedRef = useRef(false);

  // ── Resizable columns ───────────────────────────────────────────────
  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const startResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(40, startWidth + delta);
      setColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Markdown renderer for clause content ───────────────────────────
  const renderClause = (text: string) => {
    if (!text) return null;
    // Split [BM] and [EN] sections
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Process [BM] blocks
    const bmRegex = /\[BM\]\s*([\s\S]*?)(?=\[EN\]|$)/g;
    const enRegex = /\[EN\]\s*([\s\S]*?)(?=\[BM\]|$)/g;

    // Simple approach: render line by line
    const lines = text.split('\n');
    return (
      <span className="text-2xs leading-relaxed">
        {lines.map((line, i) => {
          if (!line.trim()) return <br key={i} />;
          let formatted: React.ReactNode = line;

          // Strip [BM] / [EN] labels and apply styling
          if (line.startsWith('[BM]')) {
            formatted = <span key={i} className="italic text-slate-500">{line.replace('[BM] ', '')}</span>;
          } else if (line.startsWith('[EN]')) {
            formatted = <span key={i} className="text-slate-700">{line.replace('[EN] ', '')}</span>;
          } else if (line.startsWith('•') || line.startsWith('*')) {
            formatted = <span key={i} className="text-slate-500">{line}</span>;
          }

          // Bold markers
          if (typeof formatted === 'string' && formatted.includes('**')) {
            const segments = formatted.split(/(\*\*.*?\*\*)/g);
            formatted = (
              <span key={i}>
                {segments.map((seg, j) =>
                  seg.startsWith('**') && seg.endsWith('**')
                    ? <strong key={j} className="font-semibold">{seg.slice(2, -2)}</strong>
                    : seg
                )}
              </span>
            );
          }

          return (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {formatted}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  // Load all data on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/table/Requirement/data?perPage=2000").then(r => r.json()),
      fetch("/api/admin/table/ProcessArea/data?perPage=500").then(r => r.json()),
      fetch("/api/admin/table/Standard/data?perPage=50").then(r => r.json()),
    ]).then(([reqData, paData, stdData]) => {
      setRequirements(reqData.rows || []);
      setProcessAreas(paData.rows || []);
      setStandards((stdData.rows || []).sort((a: any, b: any) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0)));
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Lazy-load controls & mappings when first expanding a requirement
  useEffect(() => {
    if (expandedReqId === null || controlsLoadedRef.current) return;
    controlsLoadedRef.current = true;
    Promise.all([
      fetch("/api/admin/table/Control/data?perPage=10000").then(r => r.json()),
      fetch("/api/admin/table/MapControl2Requirement/data?perPage=20000").then(r => r.json()),
    ]).then(([ctrlData, mapData]) => {
      setAllControls(ctrlData.rows || []);
      setAllMappings(mapData.rows || []);
    }).catch(() => { controlsLoadedRef.current = false; });
  }, [expandedReqId]);

  // Derived: controls associated with the currently expanded requirement
  const associatedControls = (() => {
    if (expandedReqId === null) return [];
    const mappingCtlIds = new Set(
      allMappings.filter((m: any) => m.requirementRId === expandedReqId).map((m: any) => m.controlId)
    );
    return allControls.filter((c: any) => mappingCtlIds.has(c.id));
  })();

  // ── Derived tree data ──────────────────────────────────────────────
  // PAs for a given Standard (by Standard.id → ProcessArea.standardId)
  const getPAsForStandard = (stdId: string) =>
    processAreas.filter(pa => pa.standardId === stdId || pa.StandardID === stdId);

  // Get Standard name by id
  const getStdName = (stdId: string) => {
    const s = standards.find((x: any) => x.id === stdId);
    return s ? s.standard : stdId;
  };

  // ── Toggle helpers ─────────────────────────────────────────────────
  const toggleStandard = (stdId: string) => {
    setExpandedStandards(prev => {
      const next = new Set(prev);
      if (next.has(stdId)) next.delete(stdId); else next.add(stdId);
      return next;
    });
    setSelStandardId(stdId);
    setSelPAId("");
    setPage(1);
  };

  const selectPA = (paId: string, stdId: string) => {
    setSelStandardId(stdId);
    setSelPAId(paId);
    setPage(1);
  };

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredReqs = requirements.filter((r: any) => {
    if (selPAId) return r.processAreaId === selPAId;
    if (selStandardId) {
      // Filter by ProcessArea.standardId matching selected Standard
      const paIds = new Set(getPAsForStandard(selStandardId).map(pa => pa.id));
      return r.processAreaId && paIds.has(r.processAreaId);
    }
    return true;
  });

  // Default sort: by Req ID ascending (natural sort handles "QMS-6.1" etc.)
  const sortedReqs = [...filteredReqs].sort((a: any, b: any) => {
    const idA = a.requirementId || "";
    const idB = b.requirementId || "";
    return idA.localeCompare(idB, undefined, { numeric: true });
  });

  // ── Pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedReqs.length / perPage));
  const pagedReqs = sortedReqs.slice((page - 1) * perPage, page * perPage);

  // ── Name lookups ───────────────────────────────────────────────────
  const getPAName = (req: any) => {
    if (req.processAreaId) {
      const pa = processAreas.find((p: any) => p.id === req.processAreaId);
      if (pa) return pa.name;
    }
    // Fallback: match by pId (for un-backfilled rows)
    const pa = processAreas.find((p: any) => p.pId === req.pId);
    return pa ? pa.name : req.pId;
  };
  // ── Breadcrumb labels ──────────────────────────────────────────────
  const selPAName = selPAId ? (processAreas.find(p => p.id === selPAId)?.name || selPAId) : "";

  // ── Edit helpers ───────────────────────────────────────────────────
  // Normalize requirement data: handles both Prisma field names (rId, pId) and
  // raw DB column names (rID, pID) that the generic API may return.
  const normalizeReq = (req: any) => ({
    rId: req.rId ?? req.rID ?? "",
    standard: req.standard ?? "",
    pId: req.pId ?? req.pID ?? "",
    processAreaId: req.processAreaId ?? "",
    requirementId: req.requirementId ?? "",
    clauseContent: req.clauseContent ?? "",
    intentOutcome: req.intentOutcome ?? "",
    clauseApplicability: req.clauseApplicability ?? "",
    references: req.references ?? "",
    applicable: req.applicable ?? true,
  });

  const hasUnsavedChanges = (): boolean => {
    if (!expandedReqId) return false;
    const original = requirements.find((r: any) => (r.rId ?? r.rID) === expandedReqId);
    if (!original) return false;
    const orig = normalizeReq(original);
    const fields = ["standard", "pId", "processAreaId", "requirementId", "clauseContent", "intentOutcome", "clauseApplicability", "references", "applicable"];
    return fields.some(f => String((editForm as any)[f] ?? "") !== String((orig as any)[f] ?? ""));
  };

  const toggleExpand = async (rId: number) => {
    // Collapsing the same row — just close
    if (expandedReqId === rId) {
      if (hasUnsavedChanges()) {
        if (!confirm("You have unsaved changes. Click OK to discard, or Cancel to keep editing.")) return;
      }
      setExpandedReqId(null); setEditForm({}); setMsg(null);
      return;
    }

    // Switching to a different row
    if (expandedReqId !== null && hasUnsavedChanges()) {
      const choice = confirm("You have unsaved changes.\n\nClick OK to SAVE before switching.\nClick Cancel to DISCARD changes and switch.");
      if (choice) {
        await handleSave();
      }
    }

    // Fetch the single requirement by rID from the API (guarantees correct data)
    setExpandedReqId(rId);
    setEditForm({});
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/table/Requirement/${rId}`);
      if (res.ok) {
        const req = await res.json();
        setEditForm(normalizeReq(req));
      } else {
        // Fallback: try local array
        const req = requirements.find((r: any) => (r.rId ?? r.rID) === rId);
        if (req) setEditForm(normalizeReq(req));
      }
    } catch {
      const req = requirements.find((r: any) => (r.rId ?? r.rID) === rId);
      if (req) setEditForm(normalizeReq(req));
    }
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      if (isAdding) {
        // Generate next rID
        const maxRId = Math.max(...requirements.map((r: any) => r.rId ?? r.rID ?? 0), 0);
        const newRId = maxRId + 1;
        const body = { ...editForm, rId: newRId, rID: newRId, createdAt: new Date().toISOString() };
        const res = await fetch("/api/admin/table/Requirement", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          // Fallback: raw SQL insert if generic API fails
          if (err.error && err.error.includes("not supported")) {
            // Try alternative — reload and let sync-schema handle it
            throw new Error("Add not supported via API. Use import script or sync-schema.");
          }
          throw new Error(err.error || "Failed to add");
        }
        setMsg({ type: "ok", text: `Requirement added (rID=${newRId}).` });
        setIsAdding(false);
        setExpandedReqId(null);
      } else {
        if (!expandedReqId) return;
        const res = await fetch(`/api/admin/table/Requirement/${expandedReqId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Save failed");
        setMsg({ type: "ok", text: "Requirement updated." });
      }
      const r = await fetch("/api/admin/table/Requirement/data?perPage=2000");
      setRequirements((await r.json()).rows || []);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  const clearAll = () => {
    setSelStandardId(""); setSelPAId("");
    setExpandedStandards(new Set());
    setExpandedReqId(null); setEditForm({}); setIsAdding(false); setPage(1);
  };

  const addNew = () => {
    if (!selPAId) {
      alert("Please select a Process Area in the tree first.\n\nNavigate: Standard ▶ ProcessArea, then click a Process Area to select it.");
      return;
    }
    const pa = processAreas.find((p: any) => p.id === selPAId);
    setIsAdding(true);
    setExpandedReqId(null);
    setEditForm({
      rId: "",
      standard: getStdName(selStandardId),
      pId: pa?.pId || "",
      processAreaId: selPAId,
      requirementId: "",
      clauseContent: "",
      intentOutcome: "",
      clauseApplicability: "",
      references: "",
      applicable: true,
    });
    setMsg(null);
  };

  // ── Pagination nav ─────────────────────────────────────────────────
  const goPage = (pg: number) => { if (pg >= 1 && pg <= totalPages) setPage(pg); };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading requirements...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-900 text-sm">📋 Manage Requirements ({requirements.length} rows)</span>
          <button onClick={addNew}
            className="rounded bg-green-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-green-700">
            ＋ Add Requirement
          </button>
        </div>
        <button onClick={clearAll} className="text-xs text-blue-600 hover:underline">Clear All</button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* ═════════ LEFT PANEL — Tree View ═════════ */}
        <div className="w-60 border-r border-slate-200 flex flex-col overflow-y-auto bg-white">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wide">Standards</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* "All Standards" root */}
            <button
              onClick={clearAll}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${!selStandardId ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600"}`}
            >
              <span className="w-4 text-center text-2xs">📂</span>
              <span className="truncate">All Standards</span>
              <span className="ml-auto text-2xs text-slate-400">{requirements.length}</span>
            </button>

            {standards.map(std => {
              const pas = getPAsForStandard(std.id);
              const isExpanded = expandedStandards.has(std.id);
              const isSelected = selStandardId === std.id && !selPAId;
              // Count requirements under this standard via its PAs
              const pasUnderStd = new Set(pas.map(pa => pa.id));
              const reqCount = requirements.filter((r: any) => r.processAreaId && pasUnderStd.has(r.processAreaId)).length;

              return (
                <div key={std.id}>
                  {/* Standard row */}
                  <button
                    onClick={() => toggleStandard(std.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${isSelected ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"}`}
                  >
                    <span className="w-4 text-center text-2xs">{isExpanded ? "▼" : "▶"}</span>
                    <span className="truncate">{std.standard}</span>
                    <span className="ml-auto text-2xs text-slate-400 flex-shrink-0">{reqCount}</span>
                  </button>

                  {/* Process Areas (children of standard) */}
                  {isExpanded && pas.map(pa => {
                    const isPASelected = selPAId === pa.id;
                    const paReqCount = requirements.filter((r: any) => r.processAreaId === pa.id).length;

                    return (
                      <button
                        key={pa.id}
                        onClick={() => selectPA(pa.id, std.id)}
                        className={`w-full text-left pl-8 pr-3 py-1 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${isPASelected ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600"}`}
                      >
                        <span className="truncate">{pa.name}</span>
                        <span className="ml-auto text-2xs text-slate-400 flex-shrink-0">{paReqCount}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═════════ RIGHT PANEL — Breadcrumb + Table ═════════ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/50 flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
            <button onClick={clearAll} className="hover:text-blue-600 hover:underline">📋 All</button>
            {selStandardId && (
              <>
                <span className="text-slate-300">›</span>
                <button onClick={() => { setSelPAId(""); setPage(1); }}
                  className={`hover:text-blue-600 hover:underline ${!selPAId ? "font-medium text-slate-700" : ""}`}>
                  {(() => { const n = getStdName(selStandardId); return n.length > 40 ? n.substring(0, 40) + "..." : n; })()}
                </button>
              </>
            )}
            {selPAId && (
              <>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-slate-700">{processAreas.find(pa => pa.id === selPAId)?.name || selPAId}</span>
              </>
            )}
            <span className="ml-auto text-slate-400">{sortedReqs.length} req{sortedReqs.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Pagination top */}
          {totalPages > 1 && (
            <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-slate-400">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => goPage(1)} disabled={page <= 1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">«</button>
                <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">‹</button>
                <span className="px-1 text-xs text-slate-500">{page}</span>
                <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">›</button>
                <button onClick={() => goPage(totalPages)} disabled={page >= totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">»</button>
              </div>
            </div>
          )}

          {/* Add Requirement form (shown when isAdding) */}
          {isAdding && (
            <div className="px-4 py-4 border-b border-blue-200 bg-blue-50/30 flex-shrink-0">
              <div className="max-w-3xl">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Add New Requirement — {selPAName || "Selected Process Area"}
                </h3>
                {msg && (
                  <div className={`mb-4 rounded px-3 py-2 text-xs ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {msg.text}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-slate-500">rID (auto-assigned on save)</span>
                    <input value={editForm.rId || "(auto)"} disabled className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-400" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Standard</span>
                    <input value={editForm.standard ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, standard: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">pID</span>
                    <input value={editForm.pId ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, pId: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Process Area ID</span>
                    <input value={editForm.processAreaId ?? ""} disabled className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-mono text-slate-400" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Requirement ID</span>
                    <input value={editForm.requirementId ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, requirementId: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" />
                  </label>
                  <label className="block col-span-2">
                    <span className="text-xs text-slate-500">Clause Content</span>
                    <textarea value={editForm.clauseContent ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, clauseContent: e.target.value }))} rows={3} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block col-span-2">
                    <span className="text-xs text-slate-500">Intent / Outcome</span>
                    <textarea value={editForm.intentOutcome ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, intentOutcome: e.target.value }))} rows={2} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block col-span-2">
                    <span className="text-xs text-slate-500">Clause Applicability</span>
                    <input value={editForm.clauseApplicability ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, clauseApplicability: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">References</span>
                    <input value={editForm.references ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, references: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Applicable</span>
                    <select value={editForm.applicable ? "true" : "false"} onChange={e => setEditForm((f: any) => ({ ...f, applicable: e.target.value === "true" }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white">
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleSave} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-400">
                    {saving ? "Saving..." : "Add Requirement"}
                  </button>
                  <button onClick={() => { setIsAdding(false); setEditForm({}); setMsg(null); }} className="rounded border px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table ref={tableRef} className="w-full text-xs border-collapse table-auto">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th className="w-8 px-2 py-1.5 text-left font-medium text-slate-600">#</th>
                  {([
                    { key: 'reqId', label: 'Req ID', min: 80, cls: '' },
                    { key: 'clause', label: 'Clause Content', min: 150, cls: '' },
                    { key: 'intent', label: 'Intent / Outcome', min: 120, cls: 'hidden lg:table-cell' },
                    { key: 'standard', label: 'Standard', min: 100, cls: 'hidden xl:table-cell' },
                  ] as const).map(col => (
                    <th key={col.key}
                      className={`px-2 py-1.5 text-left font-medium text-slate-600 relative select-none ${col.cls || ''}`}
                      style={colWidths[col.key] ? { width: colWidths[col.key], minWidth: col.min } : { minWidth: col.min }}
                    >
                      {col.label}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 z-10"
                        onMouseDown={(e) => startResize(col.key, e)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedReqs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-slate-400">
                      {selStandardId ? "No requirements match." : "← Expand a Standard in the tree to view requirements."}
                    </td>
                  </tr>
                ) : (
                  pagedReqs.map((req: any, i: number) => {
                    const rid = req.rId ?? req.rID;
                    return (
                    <React.Fragment key={rid}>
                      <tr
                        onClick={() => toggleExpand(rid)}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer align-top ${expandedReqId === rid ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-2 py-1 text-slate-400 text-2xs align-top">{(page - 1) * perPage + i + 1}</td>
                        <td className="px-2 py-1 text-2xs text-slate-700 break-words align-top">{req.requirementId}</td>
                        <td className="px-2 py-1 align-top" title={req.clauseContent}>
                          {renderClause(req.clauseContent || "")}
                        </td>
                        <td className="px-2 py-1 align-top hidden lg:table-cell" title={req.intentOutcome}>
                          {renderClause(req.intentOutcome || "")}
                        </td>
                        <td className="px-2 py-1 text-2xs text-slate-400 break-words align-top hidden xl:table-cell" title={req.standard}>
                          {req.standard || ""}
                        </td>
                      </tr>
                      {/* Expanded full-form row */}
                      {expandedReqId === rid && (
                        <tr key={`exp-${rid}`}>
                          <td colSpan={5} className="px-4 py-4 bg-blue-50/30 border-b border-blue-100">
                            <div className="flex gap-6">
                              {/* ── Left: Edit Form ── */}
                              <div className="flex-1 max-w-3xl">
                                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                                  Edit Requirement — {req.requirementId}
                                </h3>
                                {msg && (
                                  <div className={`mb-4 rounded px-3 py-2 text-xs ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                    {msg.text}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="block">
                                    <span className="text-xs text-slate-500">rID (PK)</span>
                                    <input value={editForm.rId ?? ""} disabled className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-400" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">Standard</span>
                                    <input value={editForm.standard ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, standard: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">pID</span>
                                    <input value={editForm.pId ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, pId: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">Process Area ID</span>
                                    <input value={editForm.processAreaId ?? ""} disabled
                                      className="mt-0.5 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-mono text-slate-400" placeholder="Auto-backfilled from pID" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">Requirement ID</span>
                                    <input value={editForm.requirementId ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, requirementId: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" />
                                  </label>
                                  <label className="block col-span-2">
                                    <span className="text-xs text-slate-500">Clause Content</span>
                                    <textarea value={editForm.clauseContent ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, clauseContent: e.target.value }))} rows={3} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                                  </label>
                                  <label className="block col-span-2">
                                    <span className="text-xs text-slate-500">Intent / Outcome</span>
                                    <textarea value={editForm.intentOutcome ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, intentOutcome: e.target.value }))} rows={2} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                                  </label>
                                  <label className="block col-span-2">
                                    <span className="text-xs text-slate-500">Clause Applicability</span>
                                    <input value={editForm.clauseApplicability ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, clauseApplicability: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">References</span>
                                    <input value={editForm.references ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, references: e.target.value }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                                  </label>
                                  <label className="block">
                                    <span className="text-xs text-slate-500">Applicable</span>
                                    <select value={editForm.applicable ? "true" : "false"} onChange={e => setEditForm((f: any) => ({ ...f, applicable: e.target.value === "true" }))} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white">
                                      <option value="true">Yes</option>
                                      <option value="false">No</option>
                                    </select>
                                  </label>
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <button onClick={handleSave} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:bg-slate-400">
                                    {saving ? "Saving..." : "Save Changes"}
                                  </button>
                                  <button onClick={() => toggleExpand(rid)} className="rounded border px-4 py-2 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                                </div>
                              </div>

                              {/* ── Right: Associated Controls ── */}
                              <div className="w-80 shrink-0 border-l border-blue-200 pl-4">
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">
                                  Associated Controls ({associatedControls.length})
                                </h4>
                                {associatedControls.length === 0 ? (
                                  <p className="text-2xs text-slate-400 italic">No controls mapped to this requirement.</p>
                                ) : (
                                  <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded">
                                    <table className="w-full text-2xs">
                                      <thead className="sticky top-0 bg-slate-100">
                                        <tr>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-500 border-b">Type</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-500 border-b">Ref</th>
                                          <th className="px-2 py-1.5 text-left font-medium text-slate-500 border-b">Name</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {associatedControls.map((ctrl: any) => (
                                          <tr key={ctrl.id} className="border-b border-slate-100 hover:bg-white">
                                            <td className="px-2 py-1 text-slate-600">{ctrl.controlType ?? ""}</td>
                                            <td className="px-2 py-1 text-slate-600 font-mono">{ctrl.controlRef ?? ""}</td>
                                            <td className="px-2 py-1">
                                              <a
                                                href={`/setup/controls?edit=${ctrl.id}`}
                                                className="text-blue-600 hover:underline text-2xs"
                                                title="Edit control"
                                              >
                                                {ctrl.name ?? "(unnamed)"}
                                              </a>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )}
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bottom */}
          {totalPages > 1 && (
            <div className="px-4 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-slate-400">{(page - 1) * perPage + 1}–{Math.min(page * perPage, sortedReqs.length)} of {sortedReqs.length}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => goPage(1)} disabled={page <= 1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">«</button>
                <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">‹</button>
                <span className="px-1 text-xs text-slate-500">{page}/{totalPages}</span>
                <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">›</button>
                <button onClick={() => goPage(totalPages)} disabled={page >= totalPages} className="px-1.5 py-0.5 border rounded disabled:opacity-30 text-xs">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
