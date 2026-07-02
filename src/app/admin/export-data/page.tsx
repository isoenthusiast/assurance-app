'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ExportStats {
  table: string;
  rowCount: number;
  columnCount: number;
}

export default function ExportDataPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('ProcessArea');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ExportStats | null>(null);

  useEffect(() => {
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

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setStats(null);

    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/export`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTable}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Get export stats
      const statsRes = await fetch(`/api/admin/table/${selectedTable}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/export-all');

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seam-assurance-backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export all failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">📤 Export Data</h1>
      <p className="text-slate-600 mb-6">Download table data as CSV files or create full database backup</p>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Export Single Table */}
        <div className="lg:col-span-2">
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Export Single Table</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExport();
              }}
              className="space-y-6 p-6"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Table:</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
                >
                  {tables.map((table) => (
                    <option key={table} value={table}>
                      {table}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-medium text-slate-900 mb-2">Export Format:</div>
                <ul className="space-y-1 list-inside">
                  <li>✓ Format: CSV (Comma-Separated Values)</li>
                  <li>✓ Encoding: UTF-8</li>
                  <li>✓ Filename: [TableName]_[Date].csv</li>
                  <li>✓ All columns and rows included</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={exporting}
                className="w-full rounded bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>⏳ Exporting...</>
                ) : (
                  <>
                    📥 Download {selectedTable}
                  </>
                )}
              </button>
            </form>

            {stats && (
              <div className="border-t border-slate-200 bg-green-50 px-6 py-4">
                <div className="text-sm">
                  <div className="font-medium text-green-900 mb-2">✅ Export Successful</div>
                  <div className="text-green-800">
                    <div>📊 Rows Exported: {stats.rowCount.toLocaleString()}</div>
                    <div>📋 Columns: {stats.columnCount}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Export All */}
        <div className="space-y-6">
          <div className="rounded border border-purple-200 bg-purple-50 p-6">
            <h3 className="font-semibold text-purple-900 mb-4">🗄️ Full Database Backup</h3>
            <p className="text-sm text-purple-700 mb-4">Download all tables as a ZIP file containing individual CSV files.</p>
            <button
              onClick={handleExportAll}
              disabled={exporting}
              className="w-full rounded bg-purple-600 px-4 py-2 text-sm text-white font-medium hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? '⏳ Processing...' : '📦 Export All'}
            </button>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900 mb-3">💡 Tips</h3>
            <ul className="text-xs text-slate-600 space-y-2">
              <li>• Export before major updates</li>
              <li>• Use for data backup</li>
              <li>• Share data with external systems</li>
              <li>• Archive historical data</li>
              <li>• Create reports</li>
            </ul>
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 CSV Format</h3>
            <p className="text-xs text-blue-700">
              Standard CSV format compatible with Excel, Google Sheets, and databases.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
