import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteAssessment } from "../actions";
import DeleteButton from "@/components/DeleteButton";
import AssessmentInfoForm from "./AssessmentInfoForm";
import ControlsSelectorWrapper from "./ControlsSelectorWrapper";
import EvidenceSection from "./EvidenceSection";
import AssignedControlsTable from "./AssignedControlsTable";

const loaOptions = [
  { value: "FirstLine", label: "1st Line" },
  { value: "SecondLine", label: "2nd Line" },
  { value: "ThirdLine", label: "3rd Line" },
];
const statusOptions = ["Planned", "InProgress", "Completed", "Cancelled"];

function toDateInput(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

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
  // Forces the control-assignment client components to remount (and pick up
  // fresh server data) whenever the assigned set OR any assignment's
  // effectiveness changes — e.g. via router.refresh() after an unassign.
  const assignmentsKey = assessment.controlAssignments
    .map((ac) => `${ac.id}:${ac.effective ?? "null"}:${ac.effectiveUpdatedAt ? new Date(ac.effectiveUpdatedAt).getTime() : "null"}`)
    .sort()
    .join(',');

  const total = assessment.samples.length;
  const tested = assessment.samples.filter((s) => s.status === "Tested").length;
  const failed = assessment.samples.filter((s) => s.conclusion === "Fail").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/fla" className="text-sm text-slate-500 hover:underline">
        ← All assessments
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{assessment.name}</h1>
        <DeleteButton action={deleteAssessment.bind(null, assessment.id)} />
      </div>

      <p className="mt-1 text-sm text-slate-500">
        {tested}/{total} samples tested{failed > 0 ? ` · ${failed} fail` : ""}
      </p>

      <AssessmentInfoForm assessment={assessment} users={users} activityTypes={activityTypes} loaOptions={loaOptions} statusOptions={statusOptions} />

      {/* Control Selection + Assigned Controls */}
      <div className="mt-6 space-y-4">
        <ControlsSelectorWrapper
          assessmentId={assessment.id}
          initialSelectedIds={Array.from(assignedControlIds)}
        />
        <AssignedControlsTable
          key={assignmentsKey}
          initialAssignments={assessment.controlAssignments}
        />
      </div>

      <EvidenceSection
        assessmentId={assessment.id}
        samples={assessment.samples}
        availableControls={availableControls}
        initialFindings={assessment.findings}
        assignedControls={assignedControls}
      />
    </div>
  );
}
