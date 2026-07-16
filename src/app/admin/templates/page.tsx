'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [processAreas, setProcessAreas] = useState<ProcessArea[]>([]);
  const [selectedProcessAreaId, setSelectedProcessAreaId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");

  // Read selectedCompanyId cookie to detect company switches
  const getCompanyId = () => {
    const match = document.cookie.match(/(?:^|;\s*)selectedCompanyId=([^;]*)/);
    return match ? match[1] : "";
  };

  useEffect(() => {
    setCompanyId(getCompanyId());

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch templates
        const templatesRes = await fetch('/api/admin/assessment-templates');
        if (!templatesRes.ok) throw new Error('Failed to fetch templates');
        const templatesData = await templatesRes.json();
        setTemplates(templatesData);

        // Fetch process areas
        try {
          const areasRes = await fetch('/api/admin/table/ProcessArea/data');
          if (areasRes.ok) {
            const areasData = await areasRes.json();
            // The endpoint returns { columns, rows, totalRows }
            if (areasData.rows && Array.isArray(areasData.rows)) {
              setProcessAreas([...areasData.rows].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }
        } catch (areaError) {
          console.warn('Failed to fetch process areas:', areaError);
          // Continue without process areas
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId]); // Re-fetch when company changes

  // Poll for company cookie changes (CompanySelector sets cookie + router.refresh)
  useEffect(() => {
    const interval = setInterval(() => {
      const newId = getCompanyId();
      if (newId !== companyId) {
        setCompanyId(newId);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [companyId]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/assessment-templates/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete template');

      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  // Filter templates by selected process area
  const filteredTemplates = selectedProcessAreaId === 'all'
    ? templates
    : templates.filter((template) =>
        template.controlLinkages.some((link) => link.control.processAreaId === selectedProcessAreaId)
      );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Admin Dashboard
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📋 Assessment Templates</h1>
          <p className="mt-1 text-slate-600">
            Create and manage assessment templates to quickly set up assessments
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
        >
          ➕ New Template
        </Link>
      </div>

      {/* Process Area Filter */}
      {processAreas.length > 0 && (
        <div className="mb-6 rounded border border-slate-200 bg-white p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Process Area:</label>
          <select
            value={selectedProcessAreaId}
            onChange={(e) => setSelectedProcessAreaId(e.target.value)}
            className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-slate-900 bg-white"
          >
            <option value="all">All Process Areas</option>
            {processAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          {filteredTemplates.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">
              Showing {filteredTemplates.length} of {templates.length} template(s)
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600 mb-4">No templates yet</p>
          <Link
            href="/admin/templates/new"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Create the first template
          </Link>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600">No templates found for the selected process area</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded border border-slate-200 bg-white p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">{template.name}</h3>
                  {template.description && (
                    <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                  )}

                  <div className="mt-4 flex gap-6 text-sm">
                    <div>
                      <span className="font-medium text-slate-700">{template.controlLinkages.length}</span>
                      <span className="text-slate-600 ml-1">control(s)</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">{template.activityTypes.length}</span>
                      <span className="text-slate-600 ml-1">activity type(s)</span>
                    </div>
                    <div>
                      <span className="text-slate-600">
                        Created {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {template.controlLinkages.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-700 mb-1">Controls:</p>
                      <div className="flex flex-wrap gap-2">
                        {template.controlLinkages.slice(0, 3).map((link) => (
                          <span
                            key={link.id}
                            className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
                          >
                            {link.control.name}
                          </span>
                        ))}
                        {template.controlLinkages.length > 3 && (
                          <span className="text-xs text-slate-500">
                            +{template.controlLinkages.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Link
                    href={`/admin/assessments/from-template/${template.id}`}
                    className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 text-sm font-medium transition-colors"
                  >
                    📋 Plan Assessment
                  </Link>
                  <Link
                    href={`/admin/templates/${template.id}`}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id, template.name)}
                    className="text-red-600 hover:underline text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
