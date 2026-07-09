import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteAssessment } from "../actions";
import DeleteButton from "@/components/DeleteButton";
import AssessmentTabs from "./AssessmentTabs";

const loaOptions = [
  { value: "FirstLine", label: "1st Line" },
  { value: "SecondLine", label: "2nd Line" },
  { value: "ThirdLine", label: "3rd Line" },
];
const statusOptions = ["Planned", "InProgress", "Completed", "Cancelled"];

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      activityType: true,
      assessor: true,
      samples: {
        include: { sampleType: true },
        orderBy: { createdAt: "asc" },
      },
      controlAssignments: {
        include: { control: { include: { processArea: true, controlSubProcesses: { include: { subProcess: { select: { id: true, name: true } } } } } } },
        orderBy: { createdAt: "asc" },
      },
      findings: {
        include: {
          actions: { orderBy: { createdDate: "asc" } },
          sample: { include: { sampleType: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!assessment) notFound();

  const [activityTypes, users, allControls] = await Promise.all([
    prisma.assuranceActivityType.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.control.findMany({
      include: { processArea: true, controlSubProcesses: { include: { subProcess: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const assignedControlIds = new Set(assessment.controlAssignments.map((ac) => ac.controlId));
  const availableControls = allControls.filter((c) => !assignedControlIds.has(c.id));
  const assignedControls = assessment.controlAssignments
    .map((ac) => ({ id: ac.control.id, name: ac.control.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const assignmentsKey = assessment.controlAssignments
    .map((ac) => `${ac.id}:${ac.effective ?? "null"}:${ac.effectiveUpdatedAt ? new Date(ac.effectiveUpdatedAt).getTime() : "null"}`)
    .sort()
    .join(',');

  const total = assessment.samples.length;
  const tested = assessment.samples.filter((s) => s.status === "Tested").length;
  const failed = assessment.samples.filter((s) => s.conclusion === "Fail").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href="/fla" className="text-sm text-slate-500 hover:underline">
            ← All assessments
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-0.5">{assessment.name}</h1>
          <p className="text-xs text-slate-500">
            {tested}/{total} samples tested{failed > 0 ? ` · ${failed} fail` : ""}
          </p>
        </div>
        <DeleteButton action={deleteAssessment.bind(null, assessment.id)} />
      </div>

      <AssessmentTabs
        assessment={assessment}
        users={users}
        activityTypes={activityTypes}
        loaOptions={loaOptions}
        statusOptions={statusOptions}
        assignedControlIds={assignedControlIds}
        assignmentsKey={assignmentsKey}
        availableControls={availableControls}
        assignedControls={assignedControls}
        samples={assessment.samples}
        findings={assessment.findings}
      />
    </div>
  );
}
