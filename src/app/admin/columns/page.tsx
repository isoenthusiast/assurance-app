'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Column {
  name: string;
  type: string;
  required: boolean;
  isId: boolean;
}

interface TableMetadata {
  name: string;
  columns: Column[];
}

export default function ColumnsManagementPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('User');
  const [tableMetadata, setTableMetadata] = useState<TableMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('String');
  const [newColumnRequired, setNewColumnRequired] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{ message: string; nextSteps: string[] } | null>(null);

  useEffect(() => {
    // Fetch available tables
    const fetchTables = async () => {
      try {
        const res = await fetch('/api/admin/tables');
        if (!res.ok) throw new Error('Failed to fetch tables');
        const data = await res.json();
        setTables(data.tables || []);
      } catch (err) {
        setError('Failed to load tables');
      }
    };

    fetchTables();
  }, []);

  useEffect(() => {
    // Fetch metadata for selected table
    const fetchMetadata = async () => {
      if (!selectedTable) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/table/${selectedTable}/columns`);
        if (!res.ok) throw new Error('Failed to fetch table metadata');
        const data = await res.json();
        setTableMetadata(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load table metadata');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [selectedTable]);

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) {
      setError('Column name is required');
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);
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

      const data = await res.json();
      setSuccessMessage({
        message: data.message,
        nextSteps: data.nextSteps || []
      });

      // Refresh table metadata to show new column
      const refreshRes = await fetch(`/api/admin/table/${selectedTable}/columns`);
      const newMetadata = await refreshRes.json();
      setTableMetadata(newMetadata);

      // Reset form
      setNewColumnName('');
      setNewColumnType('String');
      setNewColumnRequired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    }
  };

  const handleDeleteColumn = async (columnName: string) => {
    if (!confirm(`Delete column "${columnName}"? This cannot be undone.`)) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/table/${selectedTable}/columns/${columnName}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete column');
      }

      // Refresh metadata
      const refreshRes = await fetch(`/api/admin/table/${selectedTable}/columns`);
      const newMetadata = await refreshRes.json();
      setTableMetadata(newMetadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">🎛️ Column Management</h1>
      <p className="text-slate-600 mb-6">Add, edit, or remove columns from any table</p>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4">
          <div className="font-semibold text-green-900 mb-2">✅ {successMessage.message}</div>
          {successMessage.nextSteps.length > 0 && (
            <div className="text-xs text-green-700">
              {successMessage.nextSteps.join(' ')}
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Table:</label>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="w-full md:w-64 rounded border border-slate-300 px-3 py-2 text-slate-900"
        >
          {tables.map((table) => (
            <option key={table} value={table}>
              {table}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-slate-500">Loading...</div>
      ) : tableMetadata ? (
        <div className="space-y-8">
          {/* Current Columns */}
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Current Columns</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Column Name</th>
                    <th className="px-6 py-3">Data Type</th>
                    <th className="px-6 py-3">Required</th>
                    <th className="px-6 py-3">Primary Key</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableMetadata.columns.map((col) => (
                    <tr key={col.name} className="border-t border-slate-100">
                      <td className="px-6 py-3 font-medium text-slate-900">{col.name}</td>
                      <td className="px-6 py-3 text-slate-600">{col.type}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${col.required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {col.required ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${col.isId ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {col.isId ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleDeleteColumn(col.name)}
                          disabled={col.isId}
                          className="text-red-600 hover:underline disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                          {col.isId ? '—' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add New Column */}
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Add New Column</h2>
            </div>
            <form onSubmit={handleAddColumn} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Column Name:</label>
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="e.g., email"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Type:</label>
                  <select
                    value={newColumnType}
                    onChange={(e) => setNewColumnType(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                  >
                    <option value="String">String (Text)</option>
                    <option value="Int">Integer (Number)</option>
                    <option value="Float">Float (Decimal)</option>
                    <option value="Boolean">Boolean (True/False)</option>
                    <option value="DateTime">DateTime (Date & Time)</option>
                    <option value="Json">JSON (Complex Data)</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newColumnRequired}
                      onChange={(e) => setNewColumnRequired(e.target.checked)}
                      className="rounded"
                    />
                    Required
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
              >
                ➕ Add Column
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="text-center text-slate-500">Select a table to view columns</div>
      )}
    </div>
  );
}
