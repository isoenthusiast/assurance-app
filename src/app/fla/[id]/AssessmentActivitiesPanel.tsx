'use client';

import { useState, useEffect, useCallback } from 'react';

interface AactRecord {
  id: string;
  aaID: string;
  assuranceID: string;
  assacttypeid: string;
  activityName: string;
  activityDate: string;
  activityStartTime: string;
  activityEndTime: string;
  activityDuration: string | null;
  activityDescription: string | null;
  createdAt: string;
}

interface AActUser {
  id: string;
  aaId: string;
  userId: string;
  userRoles: string;
  assignmentRemarks: string | null;
}

interface AActControl {
  id: string;
  aaId: string;
  controlId: string;
}

const TYPE_LABELS: Record<string, string> = {
  'ACT-001': 'Interview',
  'ACT-002': 'DocumentReview',
  'ACT-003': 'Site Visit',
};

const SUB_TABS = [
  { id: 'users' as const, label: 'Users & Attachments' },
  { id: 'details' as const, label: 'Activity Details' },
  { id: 'controls' as const, label: 'Controls Mapping' },
];

export default function AssessmentActivitiesPanel({
  assessmentId,
  users,
}: {
  assessmentId: string;
  users: any[];
}) {
  const [activities, setActivities] = useState<AactRecord[]>([]);
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'users' | 'details' | 'controls'>('users');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    assacttypeid: 'ACT-001',
    activityName: '',
    activityDate: new Date().toISOString().slice(0, 10),
    activityStartTime: '09:00',
    activityEndTime: '10:00',
    activityDuration: '1h',
    activityDescription: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    activityName: '',
    activityDate: '',
    activityStartTime: '',
    activityEndTime: '',
    activityDuration: '',
    activityDescription: '',
    assacttypeid: '',
  });

  // Users sub-tab state
  const [actUsers, setActUsers] = useState<AActUser[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoles, setAssignRoles] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');

  // Controls sub-tab state
  const [actControls, setActControls] = useState<AActControl[]>([]);
  const [availableControls, setAvailableControls] = useState<any[]>([]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/table/Aact/data?perPage=500`);
      const d = await res.json();
      const all = (d.rows || []).filter((a: AactRecord) => a.assuranceID === assessmentId);
      setActivities(all);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [assessmentId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Load sub-data when activity selected
  useEffect(() => {
    if (!selectedId) return;
    // Load AActUsers
    fetch(`/api/admin/table/AActUsers/data?perPage=500`)
      .then(r => r.json())
      .then(d => setActUsers((d.rows || []).filter((u: AActUser) => u.aaId === selectedId)));
    // Load AActControls
    fetch(`/api/admin/table/AActControls/data?perPage=500`)
      .then(r => r.json())
      .then(d => setActControls((d.rows || []).filter((c: AActControl) => c.aaId === selectedId)));
    // Load edit form
    const act = activities.find(a => a.id === selectedId);
    if (act) {
      setEditForm({
        activityName: act.activityName || '',
        activityDate: act.activityDate ? act.activityDate.slice(0, 10) : '',
        activityStartTime: act.activityStartTime || '',
        activityEndTime: act.activityEndTime || '',
        activityDuration: act.activityDuration || '',
        activityDescription: act.activityDescription || '',
        assacttypeid: act.assacttypeid || 'ACT-001',
      });
    }
  }, [selectedId, activities]);

  // Load all controls for mapping
  useEffect(() => {
    fetch(`/api/admin/table/Control/data?perPage=2000`)
      .then(r => r.json())
      .then(d => setAvailableControls(d.rows || []));
  }, []);

  const handleAdd = async () => {
    setMsg(null);
    try {
      const body = {
        id: `aact_${Date.now()}`,
        aaID: `AA-${Date.now()}`,
        assuranceID: assessmentId,
        ...addForm,
        activityDate: new Date(addForm.activityDate).toISOString(),
      };
      const res = await fetch('/api/admin/table/Aact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMsg({ type: 'ok', text: 'Activity created.' });
      setShowAdd(false);
      setAddForm({ assacttypeid: 'ACT-001', activityName: '', activityDate: new Date().toISOString().slice(0, 10), activityStartTime: '09:00', activityEndTime: '10:00', activityDuration: '1h', activityDescription: '' });
      loadActivities();
    } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    setMsg(null);
    try {
      const body = {
        ...editForm,
        activityDate: editForm.activityDate ? new Date(editForm.activityDate).toISOString() : undefined,
      };
      const res = await fetch(`/api/admin/table/Aact/${selectedId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMsg({ type: 'ok', text: 'Activity updated.' });
      loadActivities();
    } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Delete this activity and all its users/controls?')) return;
    try {
      await fetch(`/api/admin/table/Aact/${id}`, { method: 'DELETE' });
      if (selectedId === id) setSelectedId(null);
      loadActivities();
    } catch { /* ignore */ }
  };

  const handleAssignUser = async () => {
    if (!selectedId || !assignUserId) return;
    setMsg(null);
    try {
      const res = await fetch('/api/admin/table/AActUsers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: `au_${Date.now()}`, aaId: selectedId, userId: assignUserId, userRoles: assignRoles, assignmentRemarks: assignRemarks }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMsg({ type: 'ok', text: 'User assigned.' });
      setAssignUserId(''); setAssignRoles(''); setAssignRemarks('');
      const res2 = await fetch(`/api/admin/table/AActUsers/data?perPage=500`);
      const d2 = await res2.json();
      setActUsers((d2.rows || []).filter((u: AActUser) => u.aaId === selectedId));
    } catch (e: any) { setMsg({ type: 'err', text: e.message }); }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Remove this user?')) return;
    try {
      await fetch(`/api/admin/table/AActUsers/${userId}`, { method: 'DELETE' });
      const res = await fetch(`/api/admin/table/AActUsers/data?perPage=500`);
      const d = await res.json();
      setActUsers((d.rows || []).filter((u: AActUser) => u.aaId === selectedId));
    } catch { /* ignore */ }
  };

  const handleAddControl = async (controlId: string) => {
    if (!selectedId) return;
    try {
      await fetch('/api/admin/table/AActControls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: `ac_${Date.now()}`, aaId: selectedId, controlId }),
      });
      const res = await fetch(`/api/admin/table/AActControls/data?perPage=500`);
      const d = await res.json();
      setActControls((d.rows || []).filter((c: AActControl) => c.aaId === selectedId));
    } catch { /* ignore */ }
  };

  const handleRemoveControl = async (ctrlId: string) => {
    try {
      await fetch(`/api/admin/table/AActControls/${ctrlId}`, { method: 'DELETE' });
      const res = await fetch(`/api/admin/table/AActControls/data?perPage=500`);
      const d = await res.json();
      setActControls((d.rows || []).filter((c: AActControl) => c.aaId === selectedId));
    } catch { /* ignore */ }
  };

  const selectedActivity = activities.find(a => a.id === selectedId);
  const assignedControlIds = new Set(actControls.map(c => c.controlId));
  const unassignedControls = availableControls.filter(c => !assignedControlIds.has(c.id));

  const filtered = filter === 'All'
    ? activities
    : activities.filter(a => a.assacttypeid === filter);

  return (
    <div className="flex h-full gap-0">
      {/* LEFT: Activity List */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col">
        <div className="px-3 py-2 border-b border-slate-200 space-y-2">
          {/* Filter radio buttons */}
          <div className="flex flex-wrap gap-1">
            {['All', 'ACT-001', 'ACT-002', 'ACT-003'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-2xs rounded border ${filter === f ? 'bg-blue-100 border-blue-300 text-blue-700 font-medium' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {f === 'All' ? 'All' : TYPE_LABELS[f] || f}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="w-full rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            ＋ Add Assessment Activity
          </button>
        </div>

        {msg && (
          <div className={`mx-2 mt-1 rounded px-2 py-1 text-2xs ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="p-3 text-xs text-slate-400">Loading...</div>
          : filtered.length === 0 ? <div className="p-3 text-xs text-slate-400">No activities yet.</div>
          : filtered.map(a => (
            <button key={a.id} onClick={() => { setSelectedId(a.id); setSubTab('users'); }}
              className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 hover:bg-slate-50 ${selectedId === a.id ? 'bg-blue-50 border-l-2 border-l-blue-500 font-medium' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="truncate font-medium">{a.activityName}</span>
                <span className="text-2xs text-slate-400 ml-1">{TYPE_LABELS[a.assacttypeid] || a.assacttypeid}</span>
              </div>
              <div className="text-2xs text-slate-400 mt-0.5">
                {a.activityDate ? new Date(a.activityDate).toLocaleDateString() : ''} · {a.activityStartTime}–{a.activityEndTime}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Sub-tabs */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            ← Select an activity or add a new one
          </div>
        ) : (
          <>
            {/* Sub-tab header */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-2">
              {SUB_TABS.map(t => (
                <button key={t.id} onClick={() => setSubTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 ${subTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
              <div className="flex-1" />
              <button onClick={() => handleDeleteActivity(selectedId!)}
                className="px-2 py-1 text-2xs text-red-500 hover:underline self-center">Delete Activity</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Tab 1: Users & Attachments */}
              {subTab === 'users' && selectedActivity && (
                <div className="space-y-4 max-w-2xl">
                  {/* Activity Summary */}
                  <div className="rounded border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">{selectedActivity.activityName}</div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                      <div>Type: <span className="text-slate-700">{TYPE_LABELS[selectedActivity.assacttypeid] || selectedActivity.assacttypeid}</span></div>
                      <div>Date: <span className="text-slate-700">{selectedActivity.activityDate ? new Date(selectedActivity.activityDate).toLocaleDateString() : '—'}</span></div>
                      <div>Time: <span className="text-slate-700">{selectedActivity.activityStartTime} – {selectedActivity.activityEndTime}</span></div>
                      <div>Duration: <span className="text-slate-700">{selectedActivity.activityDuration || '—'}</span></div>
                    </div>
                    {selectedActivity.activityDescription && (
                      <div className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">{selectedActivity.activityDescription}</div>
                    )}
                  </div>

                  {/* Attachments placeholder */}
                  <div className="rounded border border-slate-200">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">📎 Attachments</div>
                    <div className="p-3 text-xs text-slate-400 italic">Attachment upload will be available soon.</div>
                  </div>

                  {/* User Assignment */}
                  <div className="rounded border border-slate-200">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">👤 Assigned Participants</div>
                    <div className="p-3 space-y-3">
                      {/* Add user form */}
                      <div className="flex items-end gap-2 flex-wrap">
                        <label className="block flex-1 min-w-[120px]">
                          <span className="text-2xs text-slate-500">User</span>
                          <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white">
                            <option value="">— Select —</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                          </select>
                        </label>
                        <label className="block flex-1 min-w-[100px]">
                          <span className="text-2xs text-slate-500">Role</span>
                          <input value={assignRoles} onChange={e => setAssignRoles(e.target.value)}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" placeholder="e.g. Interviewer" />
                        </label>
                        <label className="block flex-1 min-w-[100px]">
                          <span className="text-2xs text-slate-500">Remarks</span>
                          <input value={assignRemarks} onChange={e => setAssignRemarks(e.target.value)}
                            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs" placeholder="Optional" />
                        </label>
                        <button onClick={handleAssignUser}
                          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 h-[28px]">＋ Add</button>
                      </div>

                      {/* User list */}
                      {actUsers.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">No participants assigned.</div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-2 py-1 text-left font-medium text-slate-600">User</th>
                              <th className="px-2 py-1 text-left font-medium text-slate-600">Role</th>
                              <th className="px-2 py-1 text-left font-medium text-slate-600">Remarks</th>
                              <th className="px-2 py-1 w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {actUsers.map(au => {
                              const u = users.find((u: any) => u.id === au.userId);
                              return (
                                <tr key={au.id} className="border-t border-slate-100">
                                  <td className="px-2 py-1">{u?.name || u?.username || au.userId}</td>
                                  <td className="px-2 py-1">{au.userRoles || '—'}</td>
                                  <td className="px-2 py-1 text-slate-500">{au.assignmentRemarks || '—'}</td>
                                  <td className="px-2 py-1">
                                    <button onClick={() => handleRemoveUser(au.id)} className="text-red-500 hover:underline text-2xs">Remove</button>
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
              )}

              {/* Tab 2: Activity Details */}
              {subTab === 'details' && (
                <div className="space-y-3 max-w-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-500">Activity Type</span>
                      <select value={editForm.assacttypeid} onChange={e => setEditForm(f => ({ ...f, assacttypeid: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white">
                        <option value="ACT-001">Interview</option>
                        <option value="ACT-002">Document Review</option>
                        <option value="ACT-003">Site Visit</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Date</span>
                      <input type="date" value={editForm.activityDate} onChange={e => setEditForm(f => ({ ...f, activityDate: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-slate-500">Activity Name</span>
                    <input value={editForm.activityName} onChange={e => setEditForm(f => ({ ...f, activityName: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-500">Start Time</span>
                      <input type="time" value={editForm.activityStartTime} onChange={e => setEditForm(f => ({ ...f, activityStartTime: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">End Time</span>
                      <input type="time" value={editForm.activityEndTime} onChange={e => setEditForm(f => ({ ...f, activityEndTime: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Duration</span>
                      <input value={editForm.activityDuration || ''} onChange={e => setEditForm(f => ({ ...f, activityDuration: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. 1h" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-slate-500">Description</span>
                    <textarea value={editForm.activityDescription || ''} onChange={e => setEditForm(f => ({ ...f, activityDescription: e.target.value }))}
                      rows={4} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                  </label>
                  <button onClick={handleSaveEdit}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              )}

              {/* Tab 3: Controls Mapping */}
              {subTab === 'controls' && (
                <div className="space-y-4 max-w-2xl">
                  {/* Assigned controls */}
                  <div className="rounded border border-slate-200">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      Mapped Controls ({actControls.length})
                    </div>
                    {actControls.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 italic">No controls mapped yet.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-slate-600">Control</th>
                            <th className="px-2 py-1 w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {actControls.map(ac => {
                            const ctrl = availableControls.find((c: any) => c.id === ac.controlId);
                            return (
                              <tr key={ac.id} className="border-t border-slate-100">
                                <td className="px-2 py-1">{ctrl?.name || ac.controlId}</td>
                                <td className="px-2 py-1">
                                  <button onClick={() => handleRemoveControl(ac.id)} className="text-red-500 hover:underline text-2xs">Remove</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Available controls */}
                  <div className="rounded border border-slate-200">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      Available Controls ({unassignedControls.length})
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {unassignedControls.slice(0, 100).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-slate-50 hover:bg-slate-50">
                          <span className="truncate flex-1 mr-2">{c.name}</span>
                          <button onClick={() => handleAddControl(c.id)}
                            className="text-green-600 hover:underline text-2xs flex-shrink-0">＋ Map</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Activity Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">New Assessment Activity</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-slate-500">Activity Type</span>
                <select value={addForm.assacttypeid} onChange={e => setAddForm(f => ({ ...f, assacttypeid: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white">
                  <option value="ACT-001">Interview</option>
                  <option value="ACT-002">Document Review</option>
                  <option value="ACT-003">Site Visit</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Activity Name</span>
                <input value={addForm.activityName} onChange={e => setAddForm(f => ({ ...f, activityName: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. Kickoff Interview" />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Date</span>
                <input type="date" value={addForm.activityDate} onChange={e => setAddForm(f => ({ ...f, activityDate: e.target.value }))}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-xs text-slate-500">Start</span>
                  <input type="time" value={addForm.activityStartTime} onChange={e => setAddForm(f => ({ ...f, activityStartTime: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">End</span>
                  <input type="time" value={addForm.activityEndTime} onChange={e => setAddForm(f => ({ ...f, activityEndTime: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Duration</span>
                  <input value={addForm.activityDuration} onChange={e => setAddForm(f => ({ ...f, activityDuration: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="e.g. 1h" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-slate-500">Description</span>
                <textarea value={addForm.activityDescription} onChange={e => setAddForm(f => ({ ...f, activityDescription: e.target.value }))}
                  rows={2} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={handleAdd} className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Create Activity</button>
                <button onClick={() => setShowAdd(false)} className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
