import { prisma } from "@/lib/prisma";
import ControlForm from "./ControlForm";
import ControlsTable from "./ControlsTable";

export default async function ControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [controls, processAreas, subProcesses, editing] = await Promise.all([
    prisma.control.findMany({
      orderBy: [{ processArea: { name: "asc" } }, { name: "asc" }],
      include: { processArea: true, subProcess: true, _count: { select: { controlAssignments: true } } },
    }),
    prisma.processArea.findMany({ orderBy: { name: "asc" } }),
    prisma.subProcess.findMany({ orderBy: { name: "asc" } }),
    edit ? prisma.control.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Controls</h1>
      <p className="mt-1 text-sm text-slate-500">
        Control statements that need to be tested, each linked to a Process Area and Sub-Process.
      </p>

      {processAreas.length === 0 || subProcesses.length === 0 ? (
        <p className="mt-6 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create at least one Process Area and Sub-Process before adding Controls.
        </p>
      ) : (
        <>
          <ControlsTable
            controls={controls}
            processAreas={processAreas}
            subProcesses={subProcesses}
          />

          <ControlForm processAreas={processAreas} subProcesses={subProcesses} editing={editing} />
        </>
      )}
    </div>
  );
}
