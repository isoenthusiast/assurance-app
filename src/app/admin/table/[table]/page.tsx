'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import bcryptjs from 'bcryptjs';

interface Row {
  [key: string]: any;
}

interface Column {
  name: string;
  type: string;
}

interface TableData {
  columns: Column[];
  rows: Row[];
  totalRows: number;
}

export default function TableViewerPage() {
  const params = useParams();
  const tableName = params.table as string;

  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Row>({});
  const [addingRow, setAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Row>({});
  const [searching, setSearching] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [blockingChildren, setBlockingChildren] = useState<any>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sqlInput, setSqlInput] = useState('');
  const [sqlResults, setSqlResults] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [showSqlWarning, setShowSqlWarning] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const fetchTableData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/table/${tableName}/data`);
        if (!res.ok) throw new Error('Failed to fetch table data');
        const data = await res.json();
        setTableData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load table data');
      } finally {
        setLoading(false);
      }
    };

    fetchTableData();
  }, [tableName]);

  const handleEditClick = (row: Row) => {
    setEditingRow(row.id || JSON.stringify(row));
    setEditFormData({ ...row });
  };

  const handleSaveEdit = async () => {
    try {
      setError(null);
      const rowId = editFormData.id || editingRow;

      let dataToSend = { ...editFormData };

      // Hash passwordHash for User table if it's been modified
      if (tableName === 'User' && dataToSend.passwordHash && !dataToSend.passwordHash.startsWith('$2')) {
        const salt = await bcryptjs.genSalt(10);
        dataToSend.passwordHash = await bcryptjs.hash(dataToSend.passwordHash, salt);
      }

      const res = await fetch(`/api/admin/table/${tableName}/${rowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update row');
      }

      // Refresh table data
      const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
      const newData = await refreshRes.json();
      setTableData(newData);

      setEditingRow(null);
      setEditFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update row');
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Delete this row? This action cannot be undone.')) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/table/${tableName}/${rowId}`, {
        method: 'DELETE',
      });

      if (res.status === 409) {
        // Row is blocked by children - show dialog
        const data = await res.json();
        setBlockingChildren(data);
        setPendingDeleteId(rowId);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete row');
      }

      // Refresh table data
      const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
      const newData = await refreshRes.json();
      setTableData(newData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row');
    }
  };

  const handleCascadeDelete = async () => {
    if (!pendingDeleteId) return;

    try {
      setError(null);
      const res = await fetch(`/api/admin/table/${tableName}/${pendingDeleteId}?cascade=true`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete row');
      }

      // Refresh table data
      const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
      const newData = await refreshRes.json();
      setTableData(newData);

      // Close dialog
      setBlockingChildren(null);
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row');
    }
  };

  const handleCancelDelete = () => {
    setBlockingChildren(null);
    setPendingDeleteId(null);
  };

  const handleExecuteSql = async () => {
    if (!sqlInput.trim()) {
      setSqlError('Please enter a SQL query');
      return;
    }

    setExecuting(true);
    setSqlError(null);
    setSqlResults(null);

    try {
      const res = await fetch('/api/admin/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSqlError(data.error || data.details || 'Failed to execute SQL query');
      } else {
        setSqlResults(data.result);
        setSqlError(null);
      }
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setExecuting(false);
      setShowSqlWarning(false);
    }
  };

  const handleAddRow = async () => {
    try {
      setError(null);

      let dataToSend = { ...newRowData };

      // Hash passwordHash for User table
      if (tableName === 'User' && dataToSend.passwordHash) {
        const salt = await bcryptjs.genSalt(10);
        dataToSend.passwordHash = await bcryptjs.hash(dataToSend.passwordHash, salt);
      }

      const res = await fetch(`/api/admin/table/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add row');
      }

      // Refresh table data
      const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
      const newData = await refreshRes.json();
      setTableData(newData);

      setAddingRow(false);
      setNewRowData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add row');
    }
  };

  const filteredRows = tableData?.rows.filter((row) => {
    if (!searching) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searching.toLowerCase())
    );
  }) || [];

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and reset to ascending
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  const sortedAndFilteredRows = [...filteredRows].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
    if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

    // Handle numeric values
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // Handle string values (case-insensitive)
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === sortedAndFilteredRows.length && sortedAndFilteredRows.length > 0) {
      setSelectedRows(new Set());
    } else {
      const allRowIds = new Set(sortedAndFilteredRows.map((row) => row.id || JSON.stringify(row)));
      setSelectedRows(allRowIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) {
      alert('No rows selected');
      return;
    }

    if (!confirm(`Delete ${selectedRows.size} selected row(s)? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    let deletedCount = 0;
    const errors: string[] = [];

    for (const rowId of selectedRows) {
      try {
        const res = await fetch(`/api/admin/table/${tableName}/${rowId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          deletedCount++;
        } else {
          const data = await res.json();
          errors.push(`Row ${rowId}: ${data.error || 'Failed to delete'}`);
        }
      } catch (err) {
        errors.push(`Row ${rowId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Refresh table data
    try {
      const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
      const newData = await refreshRes.json();
      setTableData(newData);
    } catch (err) {
      setError('Failed to refresh table after deletion');
    }

    setSelectedRows(new Set());
    setDeleting(false);

    if (errors.length > 0) {
      setError(`Deleted ${deletedCount} row(s). Errors: ${errors.join('; ')}`);
    } else {
      setError(null);
    }
  };

  const handleClearTable = async () => {
    if (!confirm(`Delete ALL ${tableData?.totalRows || 0} rows from this table? This action cannot be undone.\n\nThe table will be dropped and recreated to clear all cache.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      // Call the new DROP and RECREATE endpoint
      const res = await fetch(`/api/admin/table/${tableName}/clear`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to clear table');
        setDeleting(false);
        return;
      }

      const result = await res.json();
      console.log('✅ Table cleared:', result);

      // Refresh table data
      try {
        const refreshRes = await fetch(`/api/admin/table/${tableName}/data`);
        const newData = await refreshRes.json();
        setTableData(newData);
      } catch (err) {
        setError('Failed to refresh table after clearing');
      }

      setSelectedRows(new Set());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear table');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">📋 {tableName} Table</h1>
        {tableData && (
          <p className="text-slate-600">
            {tableData.totalRows.toLocaleString()} rows • {tableData.columns.length} columns
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {/* SQL Warning Modal */}
      {showSqlWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">⚠️ Direct SQL Execution Warning</h2>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-900 font-semibold mb-2">🔴 CRITICAL RISKS:</p>
                <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                  <li><strong>Data Loss:</strong> Incorrect queries can permanently delete or corrupt data</li>
                  <li><strong>Data Integrity:</strong> Direct SQL bypasses application validation and constraints</li>
                  <li><strong>Performance Impact:</strong> Large queries can slow down or crash the system</li>
                  <li><strong>Audit Trail:</strong> Direct SQL modifications may not be properly logged</li>
                  <li><strong>No Undo:</strong> There is no automatic rollback mechanism</li>
                </ul>
              </div>

              <div className="rounded border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  <strong>This feature is restricted to Administrators only.</strong> Only execute SQL if you:
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside mt-2">
                  <li>Fully understand the query and its implications</li>
                  <li>Have recent database backups</li>
                  <li>Are performing authorized maintenance tasks</li>
                </ul>
              </div>

              <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-900 font-semibold">
                  Query to execute:
                </p>
                <p className="text-xs text-yellow-800 mt-1 font-mono bg-white rounded p-2 border border-yellow-200 break-all max-h-24 overflow-y-auto">
                  {sqlInput}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSqlWarning(false)}
                className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteSql}
                disabled={executing}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-slate-400 transition-colors font-medium"
              >
                {executing ? '⏳ Executing...' : '⚡ Execute at Own Risk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocking Children Dialog */}
      {blockingChildren && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">⚠️ Cannot Delete - Has Dependent Records</h2>
            </div>

            <div className="px-6 py-6 space-y-4">
              <p className="text-slate-700">
                This {tableName} has dependent records that must be deleted first:
              </p>

              <div className="space-y-3">
                {blockingChildren.children?.map((childGroup: any, idx: number) => (
                  <div key={idx} className="rounded border border-amber-200 bg-amber-50 p-3">
                    <div className="font-semibold text-amber-900 mb-2">
                      {childGroup.type} ({childGroup.count})
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {childGroup.records?.slice(0, 10).map((record: any, idx: number) => (
                        <div key={idx} className="text-sm text-amber-800">
                          • {record.name || record.recordReference || record.id}
                        </div>
                      ))}
                      {childGroup.records?.length > 10 && (
                        <div className="text-sm text-amber-700 italic">
                          ... and {childGroup.records.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {blockingChildren.message && (
                <p className="text-sm text-slate-600 italic">{blockingChildren.message}</p>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCascadeDelete}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
              >
                Delete Children & Parent
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500">Loading table data...</div>
      ) : tableData ? (
        <div className="space-y-6">
          {/* SQL Query Executor */}
          <div className="rounded border border-amber-200 bg-amber-50 p-6">
            <h3 className="font-semibold text-amber-900 mb-4">⚡ Direct SQL Query Executor</h3>
            <p className="text-sm text-amber-800 mb-4">
              Execute custom SQL queries. Use with caution - this directly accesses the database.
            </p>
            <textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              placeholder="Enter SQL query (e.g., SELECT * FROM Control WHERE controlType = 'Administrative')"
              rows={4}
              className="w-full rounded border border-amber-300 px-3 py-2 font-mono text-sm text-slate-900 mb-3"
            />
            <button
              onClick={() => setShowSqlWarning(true)}
              disabled={executing || !sqlInput.trim()}
              className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:bg-slate-400 transition-colors font-medium"
            >
              {executing ? '⏳ Executing...' : '▶ Execute Query'}
            </button>

            {/* SQL Error Display */}
            {sqlError && (
              <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                <strong>Error:</strong> {sqlError}
              </div>
            )}

            {/* SQL Results Display */}
            {sqlResults && (
              <div className="mt-4 rounded border border-green-300 bg-green-50 p-3">
                <div className="text-sm text-green-900 font-semibold mb-2">
                  ✓ {sqlResults.rowsAffected || 0} rows {sqlResults.isSelect ? 'returned' : 'affected'}
                </div>
                {sqlResults.isSelect && sqlResults.rows && sqlResults.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-green-100">
                        <tr>
                          {Object.keys(sqlResults.rows[0]).map((col) => (
                            <th key={col} className="border border-green-200 px-2 py-1 text-left font-medium text-green-900">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResults.rows.slice(0, 100).map((row: any, idx: number) => (
                          <tr key={idx} className="border-t border-green-200">
                            {Object.values(row).map((val: any, idx: number) => (
                              <td key={idx} className="border border-green-200 px-2 py-1 text-green-800">
                                {val === null ? '∅' : String(val).substring(0, 50)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sqlResults.rows.length > 100 && (
                      <div className="mt-2 text-xs text-green-700 italic">
                        Showing first 100 rows of {sqlResults.rows.length} total
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search and Actions Bar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <input
              type="text"
              placeholder="Search table..."
              value={searching}
              onChange={(e) => setSearching(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-4 py-2 text-slate-900"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAddingRow(true)}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
              >
                ➕ Add Row
              </button>
              <a
                href={`/api/admin/table/${tableName}/export`}
                download={`${tableName}.csv`}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
              >
                📥 Export
              </a>
            </div>
          </div>

          {/* Add Row Form */}
          {addingRow && (
            <div className="rounded border border-green-200 bg-green-50 p-6">
              <h3 className="font-semibold text-green-900 mb-4">Add New Row</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tableData.columns.map((col) => (
                  <div key={col.name}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {col.name}
                      <span className="text-xs text-slate-500"> ({col.type})</span>
                    </label>
                    {col.name === 'ControlID' ? (
                      <input
                        type="text"
                        disabled
                        placeholder="Derived from the selected Control — set controlId instead"
                        className="w-full rounded border border-slate-200 bg-slate-100 px-3 py-2 text-slate-400"
                      />
                    ) : col.name === 'passwordHash' ? (
                      <input
                        type="password"
                        value={String(newRowData[col.name] || '')}
                        onChange={(e) => {
                          setNewRowData({ ...newRowData, [col.name]: e.target.value });
                        }}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                        placeholder="Enter password"
                      />
                    ) : (
                      <input
                        type={col.type === 'Int' ? 'number' : col.type === 'Boolean' ? 'checkbox' : 'text'}
                        value={col.type === 'Boolean' ? '' : String(newRowData[col.name] || '')}
                        checked={col.type === 'Boolean' ? Boolean(newRowData[col.name]) : false}
                        onChange={(e) => {
                          const value =
                            col.type === 'Boolean' ? e.target.checked : col.type === 'Int' ? parseInt(e.target.value) : e.target.value;
                          setNewRowData({ ...newRowData, [col.name]: value });
                        }}
                        className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                        placeholder={`Enter ${col.name}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleAddRow}
                  className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
                >
                  ✓ Save
                </button>
                <button
                  onClick={() => {
                    setAddingRow(false);
                    setNewRowData({});
                  }}
                  className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {selectedRows.size > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-amber-900">
                {selectedRows.size} row(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:bg-slate-400 transition-colors"
                >
                  {deleting ? '⏳ Deleting...' : '🗑️ Delete Selected'}
                </button>
              </div>
            </div>
          )}

          {/* Table View */}
          <div className="rounded border border-slate-200 bg-white overflow-hidden flex flex-col">
            {/* Fixed height table container with scrollbars */}
            <div className="overflow-auto" style={{ height: 'calc(100vh - 500px)', minHeight: '400px' }}>
              {sortedAndFilteredRows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-900 w-12">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === sortedAndFilteredRows.length && sortedAndFilteredRows.length > 0}
                          onChange={toggleAllRows}
                          className="rounded border-slate-300 h-4 w-4"
                        />
                      </th>
                      {tableData.columns.map((col) => (
                        <th
                          key={col.name}
                          onClick={() => handleSort(col.name)}
                          className="px-4 py-3 text-left font-medium text-slate-900 cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span>{col.name}</span>
                            {sortColumn === col.name && (
                              <span className="text-xs font-bold">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left font-medium text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredRows.map((row, idx) => {
                      const rowId = row.id || JSON.stringify(row);
                      return (
                        <tr key={idx} className={`border-t border-slate-100 ${selectedRows.has(rowId) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}  >
                      {editingRow === rowId ? (
                        // Edit Mode
                        <>
                          <td className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(rowId)}
                              onChange={() => toggleRowSelection(rowId)}
                              className="rounded border-slate-300 h-4 w-4"
                            />
                          </td>
                          {tableData.columns.map((col) => (
                            <td key={col.name} className="px-4 py-3">
                              {col.name === 'ControlID' ? (
                                <input
                                  type="text"
                                  disabled
                                  value={String(editFormData[col.name] || '')}
                                  title="Derived from the selected Control — edit controlId instead"
                                  className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1 text-sm text-slate-400"
                                />
                              ) : col.name === 'passwordHash' ? (
                                <input
                                  type="password"
                                  placeholder="Enter new password"
                                  value={String(editFormData[col.name] || '')}
                                  onChange={(e) => {
                                    setEditFormData({ ...editFormData, [col.name]: e.target.value });
                                  }}
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
                                />
                              ) : (
                                <input
                                  type={col.type === 'Int' ? 'number' : col.type === 'Boolean' ? 'checkbox' : 'text'}
                                  value={col.type === 'Boolean' ? '' : String(editFormData[col.name] || '')}
                                  checked={col.type === 'Boolean' ? Boolean(editFormData[col.name]) : false}
                                  onChange={(e) => {
                                    const value =
                                      col.type === 'Boolean' ? e.target.checked : col.type === 'Int' ? parseInt(e.target.value) : e.target.value;
                                    setEditFormData({ ...editFormData, [col.name]: value });
                                  }}
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
                                />
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                className="text-green-600 hover:underline text-sm font-medium"
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRow(null);
                                  setEditFormData({});
                                }}
                                className="text-slate-400 hover:underline text-sm"
                              >
                                ✕ Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // View Mode
                        <>
                          <td className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(rowId)}
                              onChange={() => toggleRowSelection(rowId)}
                              className="rounded border-slate-300 h-4 w-4"
                            />
                          </td>
                          {tableData.columns.map((col) => (
                            <td key={col.name} className="px-4 py-3 text-slate-900">
                              <div className="max-w-xs truncate">
                                {col.name === 'passwordHash' ? (
                                  <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600">
                                    ••••••••
                                  </span>
                                ) : col.type === 'Boolean' ? (
                                  <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${row[col.name] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {row[col.name] ? 'true' : 'false'}
                                  </span>
                                ) : (
                                  String(row[col.name] || '—')
                                )}
                              </div>
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditClick(row)}
                                className="text-blue-600 hover:underline text-sm font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row.id || JSON.stringify(row))}
                                className="text-red-600 hover:underline text-sm font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-12 text-center text-slate-400">
                  {searching ? 'No rows match your search' : 'No data in this table'}
                </div>
              )}
            </div>
          </div>

          {/* Bulk Actions Footer */}
          {tableData && tableData.totalRows > 0 && (
            <div className="space-y-3">
              <div className="rounded border border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  📊 Displaying {sortedAndFilteredRows.length} of {tableData.totalRows} rows
                  {searching && ` (filtered from search)`}
                </div>
                <button
                  onClick={handleClearTable}
                  disabled={deleting}
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:bg-slate-400 transition-colors"
                >
                  {deleting ? '⏳ Clearing...' : '🗑️ Clear Entire Table'}
                </button>
              </div>

              {/* Sort Criteria Display */}
              {sortColumn && (
                <div className="rounded border border-blue-200 bg-blue-50 px-6 py-3">
                  <div className="text-sm text-blue-900">
                    📋 Sorted by: <span className="font-semibold">{sortColumn}</span> ({sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'})
                    <button
                      onClick={() => setSortColumn(null)}
                      className="ml-3 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      [Clear Sort]
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
