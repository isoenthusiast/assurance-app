"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  const [companyPage, setCompanyPage] = useState(1);
  const [companyPerPage, setCompanyPerPage] = useState(5);
  const [companyTotalRows, setCompanyTotalRows] = useState(0);
  const [companyTotalPages, setCompanyTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ companyID: "", companyName: "", referenceID: "", shortName: "" });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submode, setSubmode] = useState<"select" | "add">("select");

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

  const assignUserToCompany = async () => {
    if (!selectedUserId || !selectedCompanyId) { setMsg({ type: "err", text: "Select both a user and a company." }); return; }
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/table/User/${selectedUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setMsg({ type: "ok", text: "User assigned to company." });
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
            <span className="text-xs font-semibold text-slate-700">User ↔ Company Assignment</span>
          </div>
          <div className="p-3">
            <div className="flex items-end gap-2 flex-wrap">
              <label className="block flex-1 min-w-[180px]">
                <span className="text-xs text-slate-500">User</span>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select User —</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username} {u.companyId ? `(${u.companyId})` : "(no company)"}</option>)}
                </select>
              </label>
              <label className="block flex-1 min-w-[180px]">
                <span className="text-xs text-slate-500">Company</span>
                <select value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                  <option value="">— Select Company —</option>
                  {companies.map((c: any) => <option key={c.id} value={c.id}>{c.companyName} ({c.shortName || c.companyID})</option>)}
                </select>
              </label>
              <button onClick={assignUserToCompany} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 h-[30px]">＋ Assign</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Requirement Manager ────────────────────────────────────────────────────

function RequirementManager() {
  const [requirements, setRequirements] = useState<any[]>([]);
  const [processAreas, setProcessAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree expand/collapse state
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  // Current selection (drives table filter + breadcrumb)
  const [selStandard, setSelStandard] = useState<string>("");
  const [selPAId, setSelPAId] = useState<string>("");       // ProcessArea.id

  // Table pagination
  const [page, setPage] = useState(1);
  const perPage = 25;

  // Expanded requirement for full-form editing
  const [expandedReqId, setExpandedReqId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Load all data on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/table/Requirement/data?perPage=2000").then(r => r.json()),
      fetch("/api/admin/table/ProcessArea/data?perPage=500").then(r => r.json()),
    ]).then(([reqData, paData]) => {
      setRequirements(reqData.rows || []);
      setProcessAreas(paData.rows || []);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived tree data ──────────────────────────────────────────────
  const standards = [...new Set(requirements.map((r: any) => r.standard).filter(Boolean))].sort();

  // PAs for a given standard — use both processAreaId lookup AND ProcessArea.standard
  const getPAsForStandard = (std: string) => {
    const paIdsFromReqs = new Set(
      requirements.filter(r => r.standard === std && r.processAreaId).map(r => r.processAreaId)
    );
    return processAreas.filter(pa =>
      paIdsFromReqs.has(pa.id) || pa.standard === std
    );
  };

  // ── Toggle helpers ─────────────────────────────────────────────────
  const toggleStandard = (std: string) => {
    setExpandedStandards(prev => {
      const next = new Set(prev);
      if (next.has(std)) next.delete(std); else next.add(std);
      return next;
    });
    setSelStandard(std);
    setSelPAId("");
    setPage(1);
  };

  const selectPA = (paId: string, paStandard: string) => {
    setSelStandard(paStandard);
    setSelPAId(paId);
    setPage(1);
  };

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredReqs = requirements.filter((r: any) => {
    if (selPAId) return r.processAreaId === selPAId;
    if (selStandard) return r.standard === selStandard;
    return true;
  });

  // ── Pagination ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredReqs.length / perPage));
  const pagedReqs = filteredReqs.slice((page - 1) * perPage, page * perPage);

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
    return fields.some(f => String(editForm[f] ?? "") !== String(orig[f] ?? ""));
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
    if (!expandedReqId) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/table/Requirement/${expandedReqId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setMsg({ type: "ok", text: "Requirement updated." });
      const r = await fetch("/api/admin/table/Requirement/data?perPage=2000");
      setRequirements((await r.json()).rows || []);
    } catch (e: any) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  const clearAll = () => {
    setSelStandard(""); setSelPAId("");
    setExpandedStandards(new Set());
    setExpandedReqId(null); setEditForm({}); setPage(1);
  };

  // ── Pagination nav ─────────────────────────────────────────────────
  const goPage = (pg: number) => { if (pg >= 1 && pg <= totalPages) setPage(pg); };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading requirements...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-red-500 text-sm">Error: {error}</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900 text-sm">📋 Manage Requirements ({requirements.length} rows)</span>
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
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${!selStandard ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600"}`}
            >
              <span className="w-4 text-center text-2xs">📂</span>
              <span className="truncate">All Standards</span>
              <span className="ml-auto text-2xs text-slate-400">{requirements.length}</span>
            </button>

            {standards.map(std => {
              const pas = getPAsForStandard(std);
              const isExpanded = expandedStandards.has(std);
              const isSelected = selStandard === std && !selPAId;
              const reqCount = requirements.filter(r => r.standard === std).length;

              return (
                <div key={std}>
                  {/* Standard row */}
                  <button
                    onClick={() => toggleStandard(std)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-slate-50 ${isSelected ? "bg-blue-50 font-medium text-blue-700" : "text-slate-700"}`}
                  >
                    <span className="w-4 text-center text-2xs">{isExpanded ? "▼" : "▶"}</span>
                    <span className="truncate">{std}</span>
                    <span className="ml-auto text-2xs text-slate-400 flex-shrink-0">{reqCount}</span>
                  </button>

                  {/* Process Areas (children of standard) */}
                  {isExpanded && pas.map(pa => {
                    const isPASelected = selPAId === pa.id;
                    const paReqCount = requirements.filter(r => r.processAreaId === pa.id).length;

                    return (
                      <button
                        key={pa.id}
                        onClick={() => selectPA(pa.id, std)}
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
            {selStandard && (
              <>
                <span className="text-slate-300">›</span>
                <button onClick={() => { setSelPAId(""); setPage(1); }}
                  className={`hover:text-blue-600 hover:underline ${!selPAId ? "font-medium text-slate-700" : ""}`}>
                  {selStandard.length > 40 ? selStandard.substring(0, 40) + "..." : selStandard}
                </button>
              </>
            )}
            {selPAId && (
              <>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-slate-700">{selPAName}</span>
              </>
            )}
            <span className="ml-auto text-slate-400">{filteredReqs.length} req{filteredReqs.length !== 1 ? "s" : ""}</span>
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

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse table-fixed">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th className="w-8 px-2 py-1.5 text-left font-medium text-slate-600">#</th>
                  <th className="w-32 px-2 py-1.5 text-left font-medium text-slate-600">Req ID</th>
                  <th className="w-20 px-2 py-1.5 text-left font-medium text-slate-600">pID</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Clause Content</th>
                  <th className="w-28 px-2 py-1.5 text-left font-medium text-slate-600 hidden lg:table-cell">Intent / Outcome</th>
                  <th className="w-24 px-2 py-1.5 text-left font-medium text-slate-600 hidden xl:table-cell">Standard</th>
                </tr>
              </thead>
              <tbody>
                {pagedReqs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                      {selStandard ? "No requirements match." : "← Expand a Standard in the tree to view requirements."}
                    </td>
                  </tr>
                ) : (
                  pagedReqs.map((req: any, i: number) => {
                    const rid = req.rId ?? req.rID;
                    return (
                    <React.Fragment key={rid}>
                      <tr
                        onClick={() => toggleExpand(rid)}
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${expandedReqId === rid ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-2 py-1 text-slate-400 text-2xs">{(page - 1) * perPage + i + 1}</td>
                        <td className="px-2 py-1 font-mono text-2xs text-slate-700 whitespace-nowrap">{req.requirementId}</td>
                        <td className="px-2 py-1 text-2xs text-blue-600 font-mono whitespace-nowrap" title={getPAName(req)}>{req.pId}</td>
                        <td className="px-2 py-1 text-2xs text-slate-600 truncate" title={req.clauseContent}>
                          {req.clauseContent || ""}
                        </td>
                        <td className="px-2 py-1 text-2xs text-slate-500 truncate hidden lg:table-cell" title={req.intentOutcome}>
                          {req.intentOutcome || ""}
                        </td>
                        <td className="px-2 py-1 text-2xs text-slate-400 truncate hidden xl:table-cell" title={req.standard}>
                          {req.standard || ""}
                        </td>
                      </tr>
                      {/* Expanded full-form row */}
                      {expandedReqId === rid && (
                        <tr key={`exp-${rid}`}>
                          <td colSpan={6} className="px-4 py-4 bg-blue-50/30 border-b border-blue-100">
                            <div className="max-w-3xl">
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
              <span className="text-slate-400">{(page - 1) * perPage + 1}–{Math.min(page * perPage, filteredReqs.length)} of {filteredReqs.length}</span>
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
