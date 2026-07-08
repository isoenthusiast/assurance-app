'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Template {
  id: string;
  name: string;
  description: string | null;
  controlLinkages: Array<{ id: string; control: { id: string; name: string; processAreaId: string } }>;
  activityTypes: Array<{ id: string; activityType: { name: string } }>;
  createdAt: string;
}

interface ProcessArea {
  id: string;
  name: string;
}

export default function PlanAssessmentPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [templatesRes, controlsRes] = await Promise.all([
          fetch('/api/admin/assessment-templates'),
          fetch('/api/controls'),
        ]);

        if (templatesRes.ok) setTemplates(await templatesRes.json());
        if (controlsRes.ok) {
          const d = await controlsRes.json();
          setProcessAreas(d.processAreas || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTemplates = selectedProcessAreaId === 'all'
    ? templates
    : templates.filter(t => t.controlLinkages.some(l => l.control.processAreaId === selectedProcessAreaId));

  const handlePlanFromTemplate = async (templateId: string) => {
    try {
      const res = await fetch('/api/admin/assessment-templates/' + templateId);
      if (!res.ok) throw new Error('Failed to load template');
      const template = await res.json();

      // Create assessment from template
      const createRes = await fetch('/api/admin/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name + ' - ' + new Date().toLocaleDateString(),
          activityTypeId: template.activityTypes[0]?.activityTypeId || '',
          startDate: new Date().toISOString().slice(0, 10),
          loa: 'FirstLine',
          status: 'Planned',
          controlIds: template.controlLinkages.map((l: any) => l.controlId),
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create assessment');
      const assessment = await createRes.json();
      router.push('/fla/' + assessment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plan assessment');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/setup/assessments" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Assessments
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📋 Plan Assessment</h1>
          <p className="mt-1 text-slate-600">Start from a template or create from scratch</p>
        </div>
        <Link href="/fla/new" className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ➕ No Template
        </Link>
      </div>

      {error && <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">❌ {error}</div>}

      {/* Filter */}
      {processAreas.length > 0 && (
        <div className="mb-6 rounded border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Process Area:</label>
          <select value={selectedProcessAreaId} onChange={e => setSelectedProcessAreaId(e.target.value)} className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All Process Areas</option>
            {processAreas.map(pa => <option key={pa.id} value={pa.id}>{pa.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600 mb-4">No templates yet</p>
          <Link href="/fla/new" className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Create from scratch</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold text-slate-900">From a Template</h2>
          {filteredTemplates.map(template => (
            <div key={template.id} className="rounded border border-slate-200 bg-white p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
                  {template.description && <p className="mt-1 text-sm text-slate-600">{template.description}</p>}
                  <div className="mt-4 flex gap-6 text-sm">
                    <span><b>{template.controlLinkages.length}</b> control(s)</span>
                    <span><b>{template.activityTypes.length}</b> activity type(s)</span>
                  </div>
                  {template.controlLinkages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.controlLinkages.slice(0, 5).map(l => (
                        <span key={l.id} className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">{l.control.name}</span>
                      ))}
                      {template.controlLinkages.length > 5 && <span className="text-xs text-slate-500">+{template.controlLinkages.length - 5} more</span>}
                    </div>
                  )}
                </div>
                <button onClick={() => handlePlanFromTemplate(template.id)} className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 whitespace-nowrap ml-4">➕ Plan</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
