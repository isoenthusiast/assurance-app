"use client";

import { useEffect, useState, useCallback } from "react";

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
  const [view, setView] = useState<"tables" | "badges" | "templates" | "users">("tables");

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
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [mode, setMode] = useState<"select" | "add" | "manageRoles">("select");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0, position: "", companyId: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/table/User/data?perPage=500")
      .then(r => r.json()).then(d => setUsers(d.rows || []));
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
                <label className="block"><span className="text-xs text-slate-500">Company ID</span>
                  <input value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm" placeholder="e.g. C001" />
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
