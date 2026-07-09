"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Sample = {
  id: string;
  assessmentId: string;
  status: string;
  conclusion: string | null;
  comment: string | null;
  control: {
    name: string;
    statement: string;
    processArea: { name: string };
    subProcess?: { name: string } | null;
  };
};

export default function SampleRow({ sample }: { sample: Sample }) {
  const router = useRouter();
  const [status, setStatus] = useState(sample.status);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, any> = {
      status: fd.get("status")?.toString() ?? "NotTested",
      comment: fd.get("comment")?.toString() || null,
    };
    const conclusion = fd.get("conclusion")?.toString();
    if (conclusion) data.conclusion = conclusion;

    await fetch(`/api/admin/samples/${sample.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this sample? This cannot be undone.")) return;
    await fetch(`/api/admin/samples/${sample.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-2">
        <div className="font-medium text-slate-900">{sample.control.name}</div>
        <div className="text-xs text-slate-500">
          {sample.control.processArea.name} / {sample.control.subProcess.name}
        </div>
      </td>
      <td className="px-4 py-2">
        <form onSubmit={handleUpdate} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={sample.id} />
          <input type="hidden" name="assessmentId" value={sample.assessmentId} />

          <div className="flex items-center gap-2">
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="NotTested">Not Tested</option>
              <option value="Tested">Tested</option>
            </select>

            {status === "Tested" && (
              <select
                name="conclusion"
                defaultValue={sample.conclusion ?? ""}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">Conclusion…</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            )}
          </div>

          <textarea
            name="comment"
            defaultValue={sample.comment ?? ""}
            placeholder="Assessment comment"
            rows={2}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="self-start rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
