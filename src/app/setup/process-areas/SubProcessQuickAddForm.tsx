"use client";

import { createSubProcessInline } from "../sub-processes/actions";

export default function SubProcessQuickAddForm({
  processAreaId,
  processAreaName,
  onClose,
}: {
  processAreaId: string;
  processAreaName: string;
  onClose: () => void;
}) {
  async function handleSubmit(formData: FormData) {
    await createSubProcessInline(formData);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        action={handleSubmit}
        className="my-8 w-full max-w-md space-y-3 rounded border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">Add Sub-Process to {processAreaName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <input type="hidden" name="processAreaId" value={processAreaId} />

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            name="name"
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Add
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
