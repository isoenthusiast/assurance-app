"use client";

import { useRouter } from "next/navigation";

type Control = {
  id: string;
  name: string;
  statement: string;
  processArea: { name: string };
  subProcess: { name: string };
};

export default function AddSamplesForm({
  assessmentId,
  availableControls,
}: {
  assessmentId: string;
  availableControls: Control[];
}) {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const controlIds = fd.getAll("controlIds") as string[];

    for (const controlId of controlIds) {
      await fetch("/api/admin/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          status: "NotTested",
          comment: `Sample for control ${controlId}`,
        }),
      });
    }

    router.refresh();
  };

  if (availableControls.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-400">
        All defined Controls have already been sampled in this assessment.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-slate-200 p-3">
        {availableControls.map((c) => (
          <label key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="controlIds" value={c.id} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="font-medium text-slate-900">{c.name}</span>{" "}
              <span className="text-slate-500">
                ({c.processArea.name} / {c.subProcess.name})
              </span>
              <div className="text-xs text-slate-500">{c.statement}</div>
            </span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Add as Samples
      </button>
    </form>
  );
}
