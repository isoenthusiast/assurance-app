'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActivityType {
  name: string;
  description: string;
  defaultLOA: string;
}

interface SuggestionResponse {
  uniqueControlTypes: string[];
  suggestedActivityTypes: ActivityType[];
  existingActivityTypes: string[];
}

export default function AddActivityTypesPage() {
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/admin/suggest-activity-types');
        if (!res.ok) {
          throw new Error('Failed to fetch suggestions');
        }
        const data = await res.json();
        setSuggestions(data);
        // Pre-select all suggested types
        const allSuggested = new Set<string>(
          data.suggestedActivityTypes.map((a: ActivityType) => a.name)
        );
        setSelectedTypes(allSuggested);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, []);

  const toggleSelection = (typeName: string) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(typeName)) {
      newSelected.delete(typeName);
    } else {
      newSelected.add(typeName);
    }
    setSelectedTypes(newSelected);
  };

  const handleCreateActivityTypes = async () => {
    if (selectedTypes.size === 0) {
      setError('Please select at least one activity type');
      return;
    }

    const toCreate = suggestions?.suggestedActivityTypes.filter((a) =>
      selectedTypes.has(a.name)
    );

    if (!toCreate || toCreate.length === 0) {
      setError('No activity types to create');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/suggest-activity-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityTypes: toCreate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create activity types');
      }

      const result = await res.json();
      setSuccessMessage(
        `✅ Successfully created ${result.created} assurance activity type(s)!`
      );
      setSelectedTypes(new Set());

      // Refresh suggestions
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create activity types');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-blue-600 hover:underline"
      >
        ← Back to Admin Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          🎯 Add Assurance Activity Types
        </h1>
        <p className="text-slate-600">
          Based on the control types in your database, we can create corresponding assurance
          activity types for planning assessments.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500">Loading suggestions...</div>
      ) : suggestions ? (
        <div className="space-y-8">
          {/* Control Types Summary */}
          <div className="rounded border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">
              📊 Control Types Found in Database
            </h2>
            <div className="flex flex-wrap gap-2">
              {suggestions.uniqueControlTypes.map((type) => (
                <span
                  key={type}
                  className="inline-block rounded-full bg-blue-200 px-3 py-1 text-sm text-blue-900 font-medium"
                >
                  {type}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-blue-700">
              Found <strong>{suggestions.uniqueControlTypes.length}</strong> unique control
              type(s) across {suggestions.uniqueControlTypes.length} categories
            </p>
          </div>

          {/* Existing Activity Types */}
          {suggestions.existingActivityTypes.length > 0 && (
            <div className="rounded border border-green-200 bg-green-50 p-6">
              <h2 className="text-lg font-semibold text-green-900 mb-3">
                ✓ Existing Activity Types
              </h2>
              <div className="space-y-2">
                {suggestions.existingActivityTypes.map((type) => (
                  <div key={type} className="text-sm text-green-700">
                    ✓ {type}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Activity Types */}
          {suggestions.suggestedActivityTypes.length > 0 ? (
            <div className="rounded border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                💡 Suggested New Activity Types
              </h2>
              <div className="space-y-3 mb-6">
                {suggestions.suggestedActivityTypes.map((activity) => (
                  <label
                    key={activity.name}
                    className="flex items-start gap-3 p-3 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(activity.name)}
                      onChange={() => toggleSelection(activity.name)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{activity.name}</div>
                      <div className="text-sm text-slate-600">{activity.description}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Default LOA: <span className="font-mono">{activity.defaultLOA}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateActivityTypes}
                  disabled={creating || selectedTypes.size === 0}
                  className="rounded bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? '⏳ Creating...' : `✓ Create ${selectedTypes.size} Activity Type(s)`}
                </button>
                <button
                  onClick={() => setSelectedTypes(new Set())}
                  className="rounded border border-slate-300 px-6 py-3 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 p-6">
              <h2 className="text-lg font-semibold text-amber-900 mb-2">
                ✓ All Set!
              </h2>
              <p className="text-amber-700">
                All control types already have corresponding assurance activity types.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
