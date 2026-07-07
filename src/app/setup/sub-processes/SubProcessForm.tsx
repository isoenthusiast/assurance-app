"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type SubProcess = {
  id: string;
  name: string;
  description: string | null;
  processAreaId: string;
};

type ProcessArea = {
  id: string;
  name: string;
};

export default function SubProcessForm({
  editing,
  processAreas,
  defaultProcessAreaId,
}: {
  editing: SubProcess | null;
  processAreas: ProcessArea[];
  defaultProcessAreaId?: string;
}) {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = fd.get("id")?.toString();
    const data = {
      name: fd.get("name")?.toString() ?? "",
      description: fd.get("description")?.toString() || null,
      processAreaId: fd.get("processAreaId")?.toString() ?? "",
    };

    const endpoint = id ? `/api/admin/table/SubProcess/${id}` : "/api/admin/table/SubProcess";
    const res = await fetch(endpoint, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save");

    router.refresh();
    router.push("/setup/sub-processes");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 max-w-md space-y-3 rounded border border-slate-200 bg-white p-5"
    >
      <h2 className="font-medium text-slate-900">
        {editing ? "Edit Sub-Process" : "Add Sub-Process"}
      </h2>
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Process Area</label>
        <select
          name="processAreaId"
          defaultValue={editing?.processAreaId ?? defaultProcessAreaId ?? processAreas[0]?.id}
          required
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          {processAreas.map((pa: ProcessArea) => (
            <option key={pa.id} value={pa.id}>
              {pa.name}
            </option>
          ))}
        </select>
      </div>

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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {editing ? "Save changes" : "Add"}
        </button>
        {editing && (
          <Link href="/setup/sub-processes" className="text-sm text-slate-500 hover:underline">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
