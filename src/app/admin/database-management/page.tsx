'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TableInfo {
  name: string;
  columnCount: number;
  rowCount: number;
}

interface Column {
  name: string;
  type: string;
  required: boolean;
  isId: boolean;
}

const DATA_TYPES = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'];

export default function DatabaseManagementPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('String');
  const [newColumnRequired, setNewColumnRequired] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [checkingSync, setCheckingSync] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editType, setEditType] = useState('String');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns(selectedTable);
      setEditingColumn(null);
    }
  }, [selectedTable]);

  const checkDatabaseSync = async () => {
    try {
      setCheckingSync(true);
      setSyncStatus(null);
      const res = await fetch('/api/admin/database/sync-check');
      if (!res.ok) throw new Error('Failed to check sync status');
      const data = await res.json();
      setSyncStatus(data.message);
      if (data.needsMigration) {
        setError('Database schema is out of sync. Run: npx prisma migrate dev');
      }
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : 'Failed to check sync status');
    } finally {
      setCheckingSync(false);
    }
  };

  const fetchTables = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/database/tables');
      if (!res.ok) throw new Error('Failed to fetch tables');
      const data = await res.json();
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async (tableName: string) => {
    try {
      const res = await fetch(`/api/admin/table/${tableName}/columns`);
      if (!res.ok) throw new Error('Failed to fetch columns');
      const data = await res.json();
      // API returns { name, columns: [...] }
      setColumns(data.columns || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load columns');
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      setError('Table name is required');
      return;
    }
    try {
      const res = await fetch('/api/admin/database/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTableName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create table');
      }
      setSuccess(`Table '${newTableName}' created successfully`);
      setNewTableName('');
      setShowCreateTable(false);
      await fetchTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table');
    }
  };

  const handleDropTable = async (tableName: string) => {
    if (!confirm(`Are you sure you want to drop table '${tableName}'? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/database/tables/${tableName}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to drop table');
      }
      setSuccess(`Table '${tableName}' dropped successfully`);
      setSelectedTable(null);
      await fetchTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to drop table');
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !newColumnName.trim()) {
      setError('Table and column name are required');
      return;
    }
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColumnName,
          type: newColumnType,
          required: newColumnRequired,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add column');
      }
      setSuccess(`Column '${newColumnName}' added successfully`);
      setNewColumnName('');
      setNewColumnType('String');
      setNewColumnRequired(false);
      setShowAddColumn(false);
      await fetchColumns(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    }
  };

  const handleRemoveColumn = async (columnName: string) => {
    if (!selectedTable) return;
    if (!confirm(`Remove column '${columnName}'? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/columns/${columnName}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove column');
      }
      setSuccess(`Column '${columnName}' removed successfully`);
      await fetchColumns(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove column');
    }
  };

  const startEditing = (col: Column) => {
    setEditingColumn(col.name);
    setEditType(col.type);
  };

  const cancelEditing = () => {
    setEditingColumn(null);
  };

  const handleUpdateColumn = async (columnName: string) => {
    if (!selectedTable) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/columns/${columnName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: editType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update column');
      }
      setSuccess(`Column '${columnName}' type updated to ${editType}`);
      setEditingColumn(null);
      await fetchColumns(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update column');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🗄️ Database Management</h1>
          <p className="mt-1 text-sm text-slate-600">Create, drop, and manage database tables and columns</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkDatabaseSync}
            disabled={checkingSync}
            className="rounded bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {checkingSync ? '🔄 Checking...' : '🔍 Check Sync'}
          </button>
          <Link href="/admin" className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✅ {success}
        </div>
      )}

      {syncStatus && (
        <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          ℹ️ {syncStatus}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* Tables List */}
        <div className="rounded border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Tables ({tables.length})</h2>
            <button
              onClick={() => setShowCreateTable(true)}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              + New
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading tables...</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`w-full rounded border p-3 text-left text-sm transition-colors ${
                    selectedTable === table.name
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-slate-900">{table.name}</div>
                  <div className="text-xs text-slate-500">
                    {table.columnCount} columns · {table.rowCount} rows
                  </div>
                </button>
              ))}
            </div>
          )}

          {showCreateTable && (
            <form onSubmit={handleCreateTable} className="mt-4 border-t border-slate-200 pt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Table Name</label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g., MyTable"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTable(false)}
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Columns Management */}
        {selectedTable && (
          <div className="rounded border border-slate-200 bg-white p-6 md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Columns: <span className="text-blue-600">{selectedTable}</span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddColumn(true)}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  + Column
                </button>
                <button
                  onClick={() => handleDropTable(selectedTable)}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                >
                  🗑️ Drop Table
                </button>
              </div>
            </div>

            {/* Columns Table */}
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Type</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-700">Required</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-700">Primary Key</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col.name} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{col.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {editingColumn === col.name ? (
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            {DATA_TYPES.map((dt) => (
                              <option key={dt} value={dt}>{dt}</option>
                            ))}
                          </select>
                        ) : (
                          col.type
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {col.required ? '✓' : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {col.isId ? '✓' : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!col.isId && editingColumn !== col.name && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEditing(col)}
                              className="text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveColumn(col.name)}
                              className="text-red-600 hover:text-red-700 hover:underline text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {!col.isId && editingColumn === col.name && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateColumn(col.name)}
                              disabled={saving}
                              className="text-green-600 hover:text-green-700 hover:underline text-sm font-medium disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-slate-500 hover:text-slate-700 hover:underline text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showAddColumn && (
              <form onSubmit={handleAddColumn} className="mt-4 border-t border-slate-200 pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Column Name</label>
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="e.g., email"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                    <select
                      value={newColumnType}
                      onChange={(e) => setNewColumnType(e.target.value)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option>String</option>
                      <option>Int</option>
                      <option>Float</option>
                      <option>Boolean</option>
                      <option>DateTime</option>
                      <option>Json</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newColumnRequired}
                    onChange={(e) => setNewColumnRequired(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">Required</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                  >
                    Add Column
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddColumn(false)}
                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {!selectedTable && !loading && (
          <div className="rounded border border-slate-200 bg-white p-6 md:col-span-2 flex items-center justify-center text-slate-500">
            Select a table or create a new one to manage columns
          </div>
        )}
      </div>

      {/* Relational Data Exports */}
      <div className="mt-8 rounded border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">📦 SAMS Relational Data Exports</h2>
        <p className="text-sm text-slate-600 mb-4">
          Export SAMS001 controls and requirements with joined Process Area names and relationship data.
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="/api/admin/database/export-controls?format=csv"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 inline-flex items-center gap-2"
          >
            📥 Controls CSV
          </a>
          <a
            href="/api/admin/database/export-controls?format=json"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 inline-flex items-center gap-2"
          >
            📋 Controls JSON
          </a>
          <a
            href="/api/admin/database/export-requirements?format=csv"
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 inline-flex items-center gap-2"
          >
            📥 Requirements CSV
          </a>
          <a
            href="/api/admin/database/export-requirements?format=json"
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 inline-flex items-center gap-2"
          >
            📋 Requirements JSON
          </a>
        </div>
      </div>
    </div>
  );
}
