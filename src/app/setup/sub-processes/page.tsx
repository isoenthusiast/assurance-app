import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { saveSubProcess, deleteSubProcess } from "./actions";
import SubProcessesTable from "./SubProcessesTable";

export default async function SubProcessesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; processAreaId?: string }>;
}) {
  const { edit, processAreaId } = await searchParams;
  const [subProcesses, processAreas, editing] = await Promise.all([
    prisma.subProcess.findMany({
      orderBy: [{ processArea: { name: "asc" } }, { name: "asc" }],
      include: { processArea: true, _count: { select: { controls: true } } },
    }),
    prisma.processArea.findMany({ orderBy: { name: "asc" } }),
    edit ? prisma.subProcess.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Sub-Processes</h1>
      <p className="mt-1 text-sm text-slate-500">
        The sub-categories (Attributes) within a Process Area — e.g. Manage Abnormal Situations within ESP.
      </p>

      {processAreas.length === 0 ? (
        <p className="mt-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create at least one Process Area first before adding Sub-Processes.
        </p>
      ) : (
        <>
          <SubProcessesTable subProcesses={subProcesses} deleteAction={deleteSubProcess} />

          <form
            action={saveSubProcess}
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
                defaultValue={editing?.processAreaId ?? processAreaId ?? processAreas[0]?.id}
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                {processAreas.map((pa) => (
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
        </>
      )}
    </div>
  );
}
