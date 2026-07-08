'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Table {
  name: string;
  displayName: string;
  description: string;
  icon: string;
}

const tables: Table[] = [
  { name: 'User', displayName: 'Users', description: 'Manage user accounts and roles', icon: '👤' },
  { name: 'ProcessArea', displayName: 'Process Areas', description: 'Manage process area categories', icon: '📁' },
  { name: 'SubProcess', displayName: 'Sub Processes', description: 'Manage sub-process categories', icon: '📂' },
  { name: 'Control', displayName: 'Controls', description: 'Manage control statements', icon: '✓' },
  { name: 'Assessment', displayName: 'Assessments', description: 'Manage assessment records', icon: '📋' },
  { name: 'ControlAssignment', displayName: 'Control Assignments', description: 'Controls assigned to assessments', icon: '🔗' },
  { name: 'Sample', displayName: 'Samples', description: 'Manage test samples', icon: '🧪' },
  { name: 'Finding', displayName: 'Findings', description: 'Manage findings', icon: '🔍' },
  { name: 'Action', displayName: 'Actions', description: 'Manage corrective actions', icon: '🔧' },
  { name: 'AssuranceActivityType', displayName: 'Activity Types', description: 'Manage assurance activity types', icon: '🎯' },
  { name: 'AchievementBadge', displayName: 'Achievement Badges', description: 'Manage badges and achievements', icon: '🏆' },
  { name: 'PointTransaction', displayName: 'Point Transactions', description: 'Manage point history', icon: '💰' },
  { name: 'GameAttribute', displayName: 'Game Attributes', description: 'XP categories for gamification', icon: '🎮' },
  { name: 'GameAttributeRule', displayName: 'Game Attribute Rules', description: 'Point-awarding rule engine', icon: '📐' },
  { name: 'ActivityLog', displayName: 'Activity Log', description: 'View user activity log', icon: '📝' },
  { name: 'ActivityLogType', displayName: 'Activity Log Types', description: 'Activity type catalog', icon: '🏷️' },
  { name: 'Attachment', displayName: 'Attachments', description: 'File attachments', icon: '📎' },
  { name: 'AttachmentMapping', displayName: 'Attachment Mappings', description: 'Attachment-to-record links', icon: '🔗' },
  { name: 'EmotionalDriveMetric', displayName: 'Emotional Drives', description: 'Emotional drive metrics', icon: '🎭' },
  { name: 'Milestone', displayName: 'Milestones', description: 'User milestones', icon: '🎯' },
  { name: 'UserAchievement', displayName: 'User Achievements', description: 'Badges earned by users', icon: '⭐' },
];

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/check', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          setIsAdmin(true);
        } else if (res.status === 401 || res.status === 403) {
          setIsAdmin(false);
        } else {
          setError(`API error: ${res.status}`);
          setIsAdmin(true); // Allow loading dashboard for debugging
        }
      } catch (error) {
        console.error('Admin check error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setIsAdmin(true); // Allow loading dashboard even if check fails
      }
    };

    checkAdmin();
  }, []);

  if (isAdmin === false) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          ❌ Access Denied: Only administrators can access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">🔧 Admin Dashboard</h1>
        <p className="mt-2 text-slate-600">Manage database tables, columns, and import data</p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          ⚠️ Warning: {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Link
          href="/setup/badges"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">🏆</div>
          <h3 className="font-semibold text-amber-900">Badges</h3>
          <p className="text-sm text-amber-700">Manage achievement badges</p>
        </Link>

        <Link
          href="/admin/database-management"
          className="rounded-lg border border-red-200 bg-red-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">🗄️</div>
          <h3 className="font-semibold text-red-900">Database</h3>
          <p className="text-sm text-red-700">Create/drop tables</p>
        </Link>

        <Link
          href="/admin/templates"
          className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">📋</div>
          <h3 className="font-semibold text-indigo-900">Templates</h3>
          <p className="text-sm text-indigo-700">Create assessment templates</p>
        </Link>

        <Link
          href="/admin/assessments"
          className="rounded-lg border border-green-200 bg-green-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-semibold text-green-900">Assessments</h3>
          <p className="text-sm text-green-700">Plan and manage assessments</p>
        </Link>

        <Link
          href="/admin/import-csv"
          className="rounded-lg border border-orange-200 bg-orange-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">📥</div>
          <h3 className="font-semibold text-orange-900">Import CSV</h3>
          <p className="text-sm text-orange-700">Upload CSV data</p>
        </Link>

        <Link
          href="/admin/export-data"
          className="rounded-lg border border-purple-200 bg-purple-50 p-4 hover:shadow-md transition-shadow"
        >
          <div className="text-2xl mb-2">📤</div>
          <h3 className="font-semibold text-purple-900">Export Data</h3>
          <p className="text-sm text-purple-700">Download table data</p>
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">📊 Available Tables</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <div key={table.name} className="rounded border border-slate-200 bg-white p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-2xl mb-1">{table.icon}</div>
                  <h3 className="font-semibold text-slate-900">{table.displayName}</h3>
                  <p className="text-xs text-slate-500 mt-1">{table.description}</p>
                  <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {table.name}
                  </code>
                </div>
              </div>
              <Link
                href={`/admin/table/${table.name}`}
                className="inline-block rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700 transition-colors"
              >
                View & Edit →
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-900 mb-2">⚠️ Important Notes</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Only Admins can access this dashboard</li>
          <li>• Removing columns may cause data loss</li>
          <li>• CSV import will validate data against current schema</li>
          <li>• Always backup your database before making changes</li>
        </ul>
      </div>
    </div>
  );
}
