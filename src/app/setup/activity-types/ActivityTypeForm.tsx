"use client";

import Link from "next/link";
import { saveActivityType } from "./actions";

type ActivityType = {
  id: string;
  name: string;
  defaultLOA: string;
  description: string | null;
};

type LOAOption = {
  value: string;
  label: string;
};

export default function ActivityTypeForm({
  editing,
  loaOptions,
  isOpen,
  onClose,
}: {
  editing: ActivityType | null;
  loaOptions: LOAOption[];
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !editing) onClose();
      }}
    >
      <form
        action={saveActivityType}
        className="my-8 w-full max-w-md space-y-3 rounded border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">
            {editing ? "Edit Activity Type" : "Add Activity Type"}
          </h2>
          {editing ? (
            <Link
              href="/setup/activity-types"
              className="text-xl leading-none text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            name="name"
            defaultValue={editing?.name ?? ""}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Default LOA</label>
          <select
            name="defaultLOA"
            defaultValue={editing?.defaultLOA ?? "FirstLine"}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {loaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            defaultValue={editing?.description ?? ""}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editing ? "Save changes" : "Add"}
          </button>
          {editing ? (
            <Link href="/setup/activity-types" className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          ) : (
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
