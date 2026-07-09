import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { deleteSubProcess } from "./actions";
import SubProcessesTable from "./SubProcessesTable";
import SubProcessForm from "./SubProcessForm";

export default async function SubProcessesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; processAreaId?: string }>;
}) {
  const { edit, processAreaId } = await searchParams;
  const [subProcesses, processAreas, editing] = await Promise.all([
    prisma.subProcess.findMany({
      orderBy: [{ processArea: { name: "asc" } }, { name: "asc" }],
      include: { processArea: true, _count: { select: { controlSubProcesses: true } } },
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

          <SubProcessForm
            editing={editing}
            processAreas={processAreas}
            defaultProcessAreaId={processAreaId}
          />
        </>
      )}
    </div>
  );
}
