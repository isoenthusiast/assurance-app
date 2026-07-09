'use client';

import { useState, useEffect } from 'react';

interface SampleType {
  id: string;
  name: string;
}

interface RecordSource {
  id: string;
  name: string;
}

interface Control {
  id: string;
  name: string;
  processArea: { name: string };
  subProcess?: { name: string } | null;
}

interface Sample {
  id: string;
  sampleTypeId: string | null;
  recordSourceId: string | null;
  recordReference: string | null;
  controlEffective: boolean;
  status: string;
  comment?: string | null;
  sampleType?: SampleType | null;
  recordSource?: RecordSource | null;
}

const itemsPerPage = 10;

export default function SamplesTable({
  assessmentId,
  initialSamples,
  availableControls,
  onAddFinding,
}: {
  assessmentId: string;
  initialSamples: Sample[];
  availableControls?: Control[];
  onAddFinding?: (sampleId: string) => void;
}) {
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [controls, setControls] = useState<Control[]>(availableControls || []);
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [recordSources, setRecordSources] = useState<RecordSource[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Sample>>({});
  const [newSampleTypeName, setNewSampleTypeName] = useState('');
  const [newRecordSourceName, setNewRecordSourceName] = useState('');
  const [showNewSampleType, setShowNewSampleType] = useState(false);
  const [showNewRecordSource, setShowNewRecordSource] = useState(false);
  const [showAddSample, setShowAddSample] = useState(false);
  const [newSampleForm, setNewSampleForm] = useState({
    sampleTypeId: '',
    recordSourceId: '',
    recordReference: '',
    controlEffective: false,
    status: 'NotTested',
    comment: '',
  });
  const [showAddSampleTypeInModal, setShowAddSampleTypeInModal] = useState(false);
  const [showAddRecordSourceInModal, setShowAddRecordSourceInModal] = useState(false);
  const [tempSampleTypeName, setTempSampleTypeName] = useState('');
  const [tempRecordSourceName, setTempRecordSourceName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/controls');
        if (res.ok) {
          const data = await res.json();
          setSampleTypes(data.sampleTypes || []);
          setRecordSources(data.recordSourceTypes || []);
          if (!controls.length) setControls(data.controls || []);
        }
      } catch (err) {
        console.error('Failed to load types:', err);
      }
    };

    fetchData();
  }, []);

  const totalPages = Math.ceil(samples.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSamples = samples.slice(startIndex, startIndex + itemsPerPage);

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const updatePageInput = (newPage: number) => {
    setCurrentPage(newPage);
    setPageInput(String(newPage));
  };

  const handleAddSampleType = async () => {
    if (!newSampleTypeName.trim()) return;

    try {
      const res = await fetch('/api/controls/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sampleType', name: newSampleTypeName }),
      });

      if (!res.ok) throw new Error('Failed to add sample type');

      const newType = await res.json();
      setSampleTypes([...sampleTypes, newType]);
      setNewSampleTypeName('');
      setShowNewSampleType(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sample type');
    }
  };

  const handleAddRecordSource = async () => {
    if (!newRecordSourceName.trim()) return;

    try {
      const res = await fetch('/api/controls/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'recordSource', name: newRecordSourceName }),
      });

      if (!res.ok) throw new Error('Failed to add record source');

      const newSource = await res.json();
      setRecordSources([...recordSources, newSource]);
      setNewRecordSourceName('');
      setShowNewRecordSource(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add record source');
    }
  };

  const handleEdit = (sample: Sample) => {
    setEditingId(sample.id);
    setEditForm({ ...sample });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`/api/admin/samples/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error('Failed to update sample');

      const updated = await res.json();
      setSamples(samples.map((s) => (s.id === editingId ? updated : s)));
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sample');
    }
  };

  const handleDelete = async (sampleId: string) => {
    if (!confirm('Delete this sample?')) return;

    try {
      const res = await fetch(`/api/admin/samples/${sampleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete sample');

      setSamples(samples.filter((s) => s.id !== sampleId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sample');
    }
  };

  const handleAddSampleTypeInModal = async () => {
    if (!tempSampleTypeName.trim()) return;

    try {
      const res = await fetch('/api/controls/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sampleType', name: tempSampleTypeName }),
      });

      if (!res.ok) throw new Error('Failed to add sample type');

      const newType = await res.json();
      setSampleTypes([...sampleTypes, newType]);
      setNewSampleForm({ ...newSampleForm, sampleTypeId: newType.id });
      setTempSampleTypeName('');
      setShowAddSampleTypeInModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sample type');
    }
  };

  const handleAddRecordSourceInModal = async () => {
    if (!tempRecordSourceName.trim()) return;

    try {
      const res = await fetch('/api/admin/table/RecordSourceType/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempRecordSourceName }),
      });

      if (!res.ok) throw new Error('Failed to add record source');

      const newSource = await res.json();
      setRecordSources([...recordSources, newSource]);
      setNewSampleForm({ ...newSampleForm, recordSourceId: newSource.id });
      setTempRecordSourceName('');
      setShowAddRecordSourceInModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add record source');
    }
  };

  const handleAddSample = async () => {
    try {
      const res = await fetch('/api/admin/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          sampleTypeId: newSampleForm.sampleTypeId || null,
          recordSourceId: newSampleForm.recordSourceId || null,
          recordReference: newSampleForm.recordReference || null,
          controlEffective: newSampleForm.controlEffective,
          status: newSampleForm.status,
          comment: newSampleForm.comment || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to add sample');

      const newSample = await res.json();
      setSamples([...samples, newSample]);
      setShowAddSample(false);
      setNewSampleForm({
        sampleTypeId: '',
        recordSourceId: '',
        recordReference: '',
        controlEffective: false,
        status: 'NotTested',
        comment: '',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add sample');
    }
  };

  const getSampleTypeName = (id: string | null) => {
    if (!id) return '—';
    return sampleTypes.find((t) => t.id === id)?.name || '—';
  };

  const getRecordSourceName = (id: string | null) => {
    if (!id) return '—';
    return recordSources.find((s) => s.id === id)?.name || '—';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Samples ({samples.length})</h3>
        <button
          onClick={() => setShowAddSample(true)}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
        >
          + Add Sample
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Sample Type</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Record Source</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Record Reference</th>
              <th className="px-4 py-3 text-center font-medium text-slate-700">Effective</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-700">Comment</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedSamples.map((sample) => (
              <tr key={sample.id} className="border-t border-slate-200 hover:bg-slate-50">
                {editingId === sample.id ? (
                  <>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={editForm.sampleTypeId || ''}
                          onChange={(e) => setEditForm({ ...editForm, sampleTypeId: e.target.value || null })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Select...</option>
                          {sampleTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowNewSampleType(true)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Add New
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          value={editForm.recordSourceId || ''}
                          onChange={(e) => setEditForm({ ...editForm, recordSourceId: e.target.value || null })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Select...</option>
                          {recordSources.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowNewRecordSource(true)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Add New
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editForm.recordReference || ''}
                        onChange={(e) => setEditForm({ ...editForm, recordReference: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.controlEffective || false}
                        onChange={(e) => setEditForm({ ...editForm, controlEffective: e.target.checked })}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editForm.status || 'NotTested'}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="NotTested">Not Tested</option>
                        <option value="Tested">Tested</option>
                      </select>
                    </td>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="mb-3 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-slate-700">Comment</label>
                          <textarea
                            value={editForm.comment || ''}
                            onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            rows={2}
                          />
                        </div>
                      </div>
                      <div className="text-right space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {getSampleTypeName(sample.sampleTypeId)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {getRecordSourceName(sample.recordSourceId)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{sample.recordReference || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {sample.controlEffective ? '✓' : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{sample.status}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate" title={sample.comment || ''}>
                      {sample.comment || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {onAddFinding && (
                        <button
                          onClick={() => onAddFinding(sample.id)}
                          className="text-amber-600 hover:underline text-xs font-medium mr-3"
                          title="Raise a finding tied to this sample"
                        >
                          + Finding
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(sample)}
                        className="text-blue-600 hover:underline text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sample.id)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {samples.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No samples added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="rounded border border-slate-200 bg-white p-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing <strong>{startIndex + 1}</strong> to{' '}
            <strong>{Math.min(startIndex + itemsPerPage, samples.length)}</strong> of{' '}
            <strong>{samples.length}</strong> samples
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updatePageInput(1)}
              disabled={currentPage === 1}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
            >
              ⇤ First
            </button>

            <button
              onClick={() => updatePageInput(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-600">Page</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePageInputSubmit()}
                onBlur={handlePageInputSubmit}
                className="w-16 rounded border border-slate-300 px-2 py-2 text-sm text-center font-medium"
              />
              <span className="text-sm text-slate-600">of {totalPages}</span>
            </div>

            <button
              onClick={() => updatePageInput(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              Next →
            </button>

            <button
              onClick={() => updatePageInput(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed font-medium"
            >
              Last ⇥
            </button>
          </div>
        </div>
      )}

      {/* Modals for adding new types */}
      {showNewSampleType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 shadow-lg max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 mb-4">Add New Sample Type</h3>
            <input
              type="text"
              value={newSampleTypeName}
              onChange={(e) => setNewSampleTypeName(e.target.value)}
              placeholder="e.g., Audit, Review, Test"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleAddSampleType()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddSampleType}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowNewSampleType(false)}
                className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewRecordSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 shadow-lg max-w-sm w-full">
            <h3 className="font-semibold text-slate-900 mb-4">Add New Record Source</h3>
            <input
              type="text"
              value={newRecordSourceName}
              onChange={(e) => setNewRecordSourceName(e.target.value)}
              placeholder="e.g., System Log, Database, Documentation"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleAddRecordSource()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddRecordSource}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => setShowNewRecordSource(false)}
                className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Sample Modal */}
      {showAddSample && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-4">Add New Sample</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type</label>
                {!showAddSampleTypeInModal ? (
                  <div className="space-y-2">
                    <select
                      value={newSampleForm.sampleTypeId}
                      onChange={(e) => setNewSampleForm({ ...newSampleForm, sampleTypeId: e.target.value })}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {sampleTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowAddSampleTypeInModal(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add New Sample Type
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={tempSampleTypeName}
                      onChange={(e) => setTempSampleTypeName(e.target.value)}
                      placeholder="Enter new sample type name"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSampleTypeInModal()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSampleTypeInModal}
                        className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddSampleTypeInModal(false);
                          setTempSampleTypeName('');
                        }}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Record Source</label>
                {!showAddRecordSourceInModal ? (
                  <div className="space-y-2">
                    <select
                      value={newSampleForm.recordSourceId}
                      onChange={(e) => setNewSampleForm({ ...newSampleForm, recordSourceId: e.target.value })}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {recordSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowAddRecordSourceInModal(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Add New Record Source
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={tempRecordSourceName}
                      onChange={(e) => setTempRecordSourceName(e.target.value)}
                      placeholder="Enter new record source name"
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddRecordSourceInModal()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddRecordSourceInModal}
                        className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddRecordSourceInModal(false);
                          setTempRecordSourceName('');
                        }}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Record Reference</label>
                <input
                  type="text"
                  value={newSampleForm.recordReference}
                  onChange={(e) => setNewSampleForm({ ...newSampleForm, recordReference: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Comment</label>
                <textarea
                  value={newSampleForm.comment}
                  onChange={(e) => setNewSampleForm({ ...newSampleForm, comment: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Add any comments..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="controlEffective"
                  checked={newSampleForm.controlEffective}
                  onChange={(e) => setNewSampleForm({ ...newSampleForm, controlEffective: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="controlEffective" className="text-xs font-medium text-slate-700">
                  Control Effective
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={newSampleForm.status}
                  onChange={(e) => setNewSampleForm({ ...newSampleForm, status: e.target.value })}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="NotTested">Not Tested</option>
                  <option value="Tested">Tested</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleAddSample}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
              >
                Add Sample
              </button>
              <button
                onClick={() => {
                  setShowAddSample(false);
                  setError(null);
                }}
                className="flex-1 rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
