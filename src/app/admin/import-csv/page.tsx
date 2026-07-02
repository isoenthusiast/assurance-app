'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface ImportResult {
  success: boolean;
  rowsImported: number;
  errors: string[];
  warnings: string[];
}

interface ValidationError {
  row: number;
  column: string;
  value: any;
  reason: string;
}

interface ValidationWarning {
  row: number;
  column: string;
  value: any;
  reason: string;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  canImport: boolean;
}

interface TemplateData {
  table: string;
  columns: string[];
  sampleRow: string[];
  example: string[][];
}

export default function ImportCSVPage() {
  const [selectedTable, setSelectedTable] = useState<string>('ProcessArea');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tables, setTables] = useState<string[]>([]);

  // Load available tables on mount
  useEffect(() => {
    const loadTables = async () => {
      try {
        const res = await fetch('/api/admin/tables');
        const data = await res.json();
        if (data.tables) {
          setTables(data.tables);
          // Set first table as default
          if (data.tables.length > 0 && selectedTable === 'ProcessArea') {
            setSelectedTable(data.tables[0]);
          }
        }
      } catch (err) {
        console.error('Error loading tables:', err);
      }
    };
    loadTables();
  }, []);

  // Load template when table changes
  useEffect(() => {
    const loadTemplate = async () => {
      setLoadingTemplate(true);
      try {
        const res = await fetch(`/api/admin/template/${selectedTable}`);
        if (!res.ok) {
          console.warn('Template API returned', res.status, res.statusText);
          setTemplate(null);
          return;
        }
        const data = await res.json();
        if (data.columns && Array.isArray(data.columns)) {
          setTemplate(data);
        } else {
          console.warn('Invalid template data:', data);
          setTemplate(null);
        }
      } catch (err) {
        console.error('Error loading template:', err);
        setTemplate(null);
      } finally {
        setLoadingTemplate(false);
      }
    };
    loadTemplate();
  }, [selectedTable]);

  const validateFile = async (fileToValidate: File) => {
    if (selectedTable !== 'Control' && selectedTable !== 'ControlAssignment') {
      // Skip validation for tables without a validate-csv implementation
      setValidation(null);
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToValidate);
      formData.append('table', selectedTable);

      const res = await fetch('/api/admin/validate-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('Validation error:', data);
        setValidation(null);
        return;
      }

      setValidation(data);
    } catch (err) {
      console.error('Error validating CSV:', err);
      setValidation(null);
    } finally {
      setValidating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setValidation(null);
      validateFile(selectedFile);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    // Prevent import if validation shows critical errors
    if (validation && !validation.canImport) {
      setError('Cannot import: CSV has critical errors. Please fix them first.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('table', selectedTable);

      const res = await fetch('/api/admin/import-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setValidation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadExample = () => {
    if (!template) return;

    // Generate CSV with headers and sample row
    const rows = [template.columns, template.sampleRow];
    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_template.csv`;
    a.click();
  };

  const downloadValidationReport = () => {
    if (!validation) return;

    let report = `CSV Validation Report\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Table: ${selectedTable}\n\n`;
    report += `Summary:\n`;
    report += `- Total rows: ${validation.totalRows}\n`;
    report += `- Valid rows: ${validation.validRows}\n`;
    report += `- Invalid rows: ${validation.invalidRows}\n`;
    report += `- Warnings: ${validation.warnings.length}\n\n`;

    if (validation.errors.length > 0) {
      report += `ERRORS (${validation.errors.length}):\n`;
      report += `${'='.repeat(80)}\n`;
      validation.errors.forEach((err) => {
        report += `Row ${err.row} - ${err.column}:\n`;
        report += `  Reason: ${err.reason}\n`;
        report += `  Value: ${JSON.stringify(err.value)}\n\n`;
      });
    }

    if (validation.warnings.length > 0) {
      report += `\nWARNINGS (${validation.warnings.length}):\n`;
      report += `${'='.repeat(80)}\n`;
      validation.warnings.forEach((warn) => {
        report += `Row ${warn.row} - ${warn.column}:\n`;
        report += `  Reason: ${warn.reason}\n`;
        report += `  Value: ${JSON.stringify(warn.value)}\n\n`;
      });
    }

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_validation_report.txt`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">📥 Import CSV Data</h1>
      <p className="text-slate-600 mb-6">Upload CSV files to populate database tables</p>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className={`mb-6 rounded border p-4 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-yellow-200 bg-yellow-50 text-yellow-800'}`}>
          <div className="font-semibold mb-2">
            {result.success ? '✅ Import Successful!' : '⚠️ Import Completed with Issues'}
          </div>
          <div className="mb-2">📊 Rows Imported: {result.rowsImported}</div>
          {result.errors.length > 0 && (
            <div>
              <div className="font-medium mb-1">Errors:</div>
              <ul className="list-inside space-y-1 ml-2">
                {result.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="mt-2">
              <div className="font-medium mb-1">Warnings:</div>
              <ul className="list-inside space-y-1 ml-2">
                {result.warnings.map((warn, i) => (
                  <li key={i}>• {warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {validating && (
        <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          ⏳ Validating CSV... (checking {validation?.totalRows || '?'} rows)
        </div>
      )}

      {validation && (
        <div className={`mb-6 rounded border p-4 ${
          validation.canImport
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className={`font-semibold mb-3 ${
            validation.canImport ? 'text-green-900' : 'text-red-900'
          }`}>
            {validation.canImport ? '✅ CSV is valid' : '❌ CSV has critical errors'}
          </div>

          {/* Summary Stats */}
          <div className={`mb-4 p-3 rounded text-sm grid grid-cols-2 gap-2 md:grid-cols-4 ${
            validation.canImport
              ? 'bg-green-100 text-green-900'
              : 'bg-red-100 text-red-900'
          }`}>
            <div>
              <div className="font-medium">{validation.totalRows}</div>
              <div className="text-xs opacity-75">Total Rows</div>
            </div>
            <div>
              <div className="font-medium text-green-700">{validation.validRows}</div>
              <div className="text-xs opacity-75">Valid</div>
            </div>
            <div>
              <div className="font-medium text-red-700">{validation.invalidRows}</div>
              <div className="text-xs opacity-75">Invalid</div>
            </div>
            <div>
              <div className="font-medium text-yellow-700">{validation.warnings.length}</div>
              <div className="text-xs opacity-75">Warnings</div>
            </div>
          </div>

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="mb-4">
              <div className="font-semibold text-red-900 mb-2">
                Errors ({validation.errors.length})
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {validation.errors.slice(0, 10).map((err, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded p-2 text-xs border-l-4 border-red-500 cursor-pointer hover:bg-red-50"
                    onClick={() => {
                      const newExpanded = new Set(expandedErrors);
                      newExpanded.has(err.row) ? newExpanded.delete(err.row) : newExpanded.add(err.row);
                      setExpandedErrors(newExpanded);
                    }}
                  >
                    <div className="font-medium text-red-700">
                      Row {err.row}: {err.column}
                    </div>
                    <div className="text-slate-600 mt-1">{err.reason}</div>
                    {expandedErrors.has(err.row) && (
                      <div className="mt-1 bg-slate-100 p-1 rounded text-slate-700 font-mono text-xs">
                        {JSON.stringify(err.value)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {validation.errors.length > 10 && (
                <div className="mt-2 text-xs text-slate-600">
                  ... and {validation.errors.length - 10} more errors
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="mb-4">
              <div className="font-semibold text-yellow-900 mb-2">
                Warnings ({validation.warnings.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validation.warnings.slice(0, 5).map((warn, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded p-2 text-xs border-l-4 border-yellow-500"
                  >
                    <div className="font-medium text-yellow-700">
                      Row {warn.row}: {warn.column}
                    </div>
                    <div className="text-slate-600 mt-1">{warn.reason}</div>
                  </div>
                ))}
              </div>
              {validation.warnings.length > 5 && (
                <div className="mt-2 text-xs text-slate-600">
                  ... and {validation.warnings.length - 5} more warnings
                </div>
              )}
            </div>
          )}

          {/* Download Report Button */}
          <button
            onClick={downloadValidationReport}
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-900 px-3 py-1 rounded"
          >
            📄 Download Full Report
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Upload Section */}
        <div className="lg:col-span-2">
          <div className="rounded border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Upload CSV</h2>
            </div>
            <form onSubmit={handleImport} className="space-y-6 p-6">
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">CSV File:</label>
                <div className="rounded border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-input"
                  />
                  <label htmlFor="csv-input" className="cursor-pointer">
                    <div className="text-3xl mb-2">📄</div>
                    <div className="font-medium text-slate-900">
                      {file ? file.name : 'Click to select CSV file'}
                    </div>
                    <div className="text-sm text-slate-500">or drag and drop</div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!file || importing || validating || (validation && !validation.canImport)}
                  className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                  title={validation && !validation.canImport ? 'Fix CSV errors before importing' : ''}
                >
                  {importing ? '⏳ Importing...' : validating ? '🔍 Validating...' : '📤 Import Data'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setValidation(null);
                  }}
                  className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Download Example */}
          <div className="rounded border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Download Template</h3>
            <p className="text-sm text-blue-700 mb-3">Get a CSV template for {selectedTable}</p>

            {loadingTemplate && (
              <div className="mb-3 text-xs text-blue-600">
                ⏳ Loading template...
              </div>
            )}

            <button
              onClick={downloadExample}
              disabled={!template || loadingTemplate}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              {loadingTemplate ? '⏳ Loading...' : '📥 Download Template'}
            </button>

            {!loadingTemplate && !template && (
              <div className="mt-3 text-xs text-amber-600 bg-amber-50 rounded p-2">
                ⚠️ Template data not loading. Try selecting a different table or check browser console.
              </div>
            )}

            {template && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-600 mb-2">
                  ✓ {template.columns.length} columns available
                </p>
                <div className="text-xs text-blue-600 bg-white rounded p-2 max-h-24 overflow-y-auto">
                  <strong>Headers:</strong>
                  <div className="mt-1 space-y-0.5">
                    {template.columns.map((col) => (
                      <div key={col} className="truncate">• {col}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="rounded border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900 mb-3">📖 Instructions</h3>
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>Select the table to import</li>
              <li>Download the example template</li>
              <li>Fill in your data</li>
              <li>Upload the CSV file (auto-validates)</li>
              <li>Fix any validation errors</li>
              <li>Click Import to proceed</li>
              <li>Review import results</li>
            </ol>
          </div>

          {/* Format Requirements */}
          <div className="rounded border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900 mb-2">✓ Format Requirements</h3>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• UTF-8 encoding</li>
              <li>• First row must be headers</li>
              <li>• Match column names exactly</li>
              <li>• Empty cells for NULL values</li>
              <li>• Use ISO 8601 for dates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
