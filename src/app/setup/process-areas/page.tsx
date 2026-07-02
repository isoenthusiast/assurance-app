import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { saveProcessArea, deleteProcessArea } from "./actions";
import ProcessAreasTable from "./ProcessAreasTable";

export default async function ProcessAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [areas, editing, allAreas] = await Promise.all([
    prisma.processArea.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        pId: true,
        standard: true,
        _count: { select: { subProcesses: true, controls: true } },
      },
    }),
    edit ? prisma.processArea.findUnique({ where: { id: edit } }) : Promise.resolve(null),
    prisma.processArea.findMany({
      select: { standard: true },
      where: { standard: { not: null } },
      distinct: ['standard'],
      orderBy: { standard: 'asc' },
    }),
  ]);

  // Get unique standards in alphabetical order
  const uniqueStandards = allAreas
    .map((pa) => pa.standard)
    .filter((s) => s !== null)
    .sort() as string[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Process Areas</h1>
      <p className="mt-1 text-sm text-slate-500">
        The work processes (Abilities) that Sub-Processes and Controls roll up under — e.g. ESP, AIPSM, MAC.
      </p>

      <ProcessAreasTable areas={areas} standards={uniqueStandards} deleteAction={deleteProcessArea} />

      <form
        action={saveProcessArea}
        className="mt-8 max-w-md space-y-3 rounded border border-slate-200 bg-white p-5"
      >
        <h2 className="font-medium text-slate-900">{editing ? "Edit Process Area" : "Add Process Area"}</h2>
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
          <label className="text-sm font-medium text-slate-700">Standard (optional)</label>
          <input
            name="standard"
            defaultValue={editing?.standard ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g., ISO 27001, SOC 2"
          />
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editing ? "Save changes" : "Add"}
          </button>
          {editing && (
            <Link href="/setup/process-areas" className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
