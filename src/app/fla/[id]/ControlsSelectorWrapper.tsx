'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ControlsSelector from './ControlsSelector';

interface ControlsSelectorWrapperProps {
  assessmentId: string;
  initialSelectedIds: string[];
}

export default function ControlsSelectorWrapper({
  assessmentId,
  initialSelectedIds,
}: ControlsSelectorWrapperProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSelectionChange = async (controlIds: string[]) => {
    setSelectedIds(controlIds);
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/controls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controlIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save controls');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // The Assigned Controls table holds its own copy of the assignment
      // list (including per-control Effective/Last Tested Date) — refresh
      // so newly added/removed controls show up there too.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save controls');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          ✅ Controls saved successfully
        </div>
      )}

      <ControlsSelector
        selectedControlIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />

      {isSaving && (
        <div className="text-xs text-slate-600 italic">
          Saving selections...
        </div>
      )}
    </div>
  );
}
