"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Editing = {
  id: string;
  name: string;
  description: string | null;
  standard?: string | null;
  pId?: string | null;
} | null;

export default function ProcessAreaForm({
  editing,
  standards,
  defaultStandard,
  isOpen,
  onClose,
}: {
  editing: Editing;
  standards: string[];
  defaultStandard?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isAddingNewStandard, setIsAddingNewStandard] = useState(
    () => Boolean(editing?.standard) && !standards.includes(editing?.standard as string)
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = formData.get("id")?.toString();

    const data = {
      name: formData.get("name")?.toString() ?? "",
      description: formData.get("description")?.toString() || null,
      standard: formData.get("standard")?.toString() ?? "",
      pId: formData.get("pId")?.toString() || null,
    };

    if (id) {
      await fetch(`/api/admin/table/ProcessArea/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      const res = await fetch("/api/admin/table/ProcessArea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
    }

    router.refresh();
    router.push("/setup/process-areas");
  };

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
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-md space-y-3 rounded border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-slate-900">{editing ? "Edit Process Area" : "Add Process Area"}</h2>
          {editing ? (
            <Link
              href="/setup/process-areas"
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
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            defaultValue={editing?.description ?? ""}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Standard</label>
            <button
              type="button"
              onClick={() => setIsAddingNewStandard((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {isAddingNewStandard ? "Choose existing" : "+ Add new Standard"}
            </button>
          </div>
          {isAddingNewStandard ? (
            <input
              name="standard"
              defaultValue={
                editing?.standard && !standards.includes(editing.standard) ? editing.standard : ""
              }
              required
              autoFocus
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g., ISO 27001, SOC 2"
            />
          ) : (
            <select
              name="standard"
              defaultValue={editing?.standard ?? defaultStandard ?? ""}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a standard…
              </option>
              {standards.map((standard) => (
                <option key={standard} value={standard}>
                  {standard}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">pId (optional)</label>
          <input
            name="pId"
            defaultValue={editing?.pId ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Process identifier"
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
            <Link href="/setup/process-areas" className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
