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
  const [mode, setMode] = useState<"select" | "add">("select");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/table/User/data?perPage=500")
      .then(r => r.json()).then(d => setUsers(d.rows || []));
  }, []);

  useEffect(() => {
    if (mode === "add") { setForm({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0 }); return; }
    if (!selectedUserId) { setForm({ name: "", username: "", role: "Assessor", password: "", totalPoints: 0 }); return; }
    const u = users.find((u: any) => u.id === selectedUserId);
    if (u) setForm({ name: u.name || "", username: u.username || "", role: u.role || "Assessor", password: "", totalPoints: u.totalPoints || 0 });
  }, [selectedUserId, users, mode]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const body: any = { name: form.name, username: form.username, role: form.role, totalPoints: Number(form.totalPoints) };
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
