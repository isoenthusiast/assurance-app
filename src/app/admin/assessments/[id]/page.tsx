'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface Assessment {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  loa: string;
  activityType: { name: string };
  assessor: { name: string };
  controlAssignments: Array<{
    id: string;
    control: {
      id: string;
      name: string;
      statement: string;
    };
  }>;
  samples: Array<{
    id: string;
    status: string;
    conclusion: string | null;
    comment: string | null;
  }>;
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/assessments/${assessmentId}`);
        if (!res.ok) throw new Error('Failed to fetch assessment');
        const data = await res.json();
        setAssessment(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assessment');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  const handleDelete = async () => {
    if (!confirm('Delete this assessment? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete assessment');
      router.push('/admin/assessments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assessment');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="text-center text-slate-500">Loading assessment...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          Assessment not found
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin/assessments" className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline">
        ← Back to Assessments
      </Link>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{assessment.name}</h1>
          <p className="mt-1 text-slate-600">Assessment Details</p>
        </div>
        <button
          onClick={handleDelete}
          className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
        >
          🗑️ Delete Assessment
        </button>
      </div>

      {/* Assessment Info */}
      <div className="mb-6 rounded border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Status</p>
            <span className={`inline-block rounded px-2 py-1 text-sm font-medium ${
              assessment.status === 'Completed'
                ? 'bg-green-100 text-green-700'
                : assessment.status === 'InProgress'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-700'
            }`}>
              {assessment.status}
            </span>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Activity Type</p>
            <p className="text-sm text-slate-900">{assessment.activityType.name}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Assessor</p>
            <p className="text-sm text-slate-900">{assessment.assessor.name}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">LOA</p>
            <p className="text-sm text-slate-900">{assessment.loa}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Start Date</p>
            <p className="text-sm text-slate-900">
              {new Date(assessment.startDate).toLocaleDateString()}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">End Date</p>
            <p className="text-sm text-slate-900">
              {assessment.endDate ? new Date(assessment.endDate).toLocaleDateString() : '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Total Controls</p>
            <p className="text-sm text-slate-900">{assessment.controlAssignments.length}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-1">Samples Tested</p>
            <p className="text-sm text-slate-900">
              {assessment.samples.filter((s) => s.status === 'Tested').length} of{' '}
              {assessment.samples.length}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Assigned Controls ({assessment.controlAssignments.length})
        </h2>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {assessment.controlAssignments.map((ca) => (
            <div key={ca.id} className="rounded border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-medium text-slate-900">{ca.control.name}</h3>
              <p className="text-xs text-slate-600 mt-1">{ca.control.statement}</p>
            </div>
          ))}
          {assessment.controlAssignments.length === 0 && (
            <p className="text-sm text-slate-400">No controls assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
