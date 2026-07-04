import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { updateAssessment, deleteAssessment } from "../actions";
import DeleteButton from "@/components/DeleteButton";
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
        include: { control: { include: { processArea: true, subProcess: true } } },
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
      include: { processArea: true, subProcess: true },
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

      <form
        action={updateAssessment}
        className="mt-4 grid grid-cols-2 gap-3 rounded border border-slate-200 bg-white p-5"
      >
        <input type="hidden" name="id" value={assessment.id} />

        <div className="col-span-2 space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            name="name"
            defaultValue={assessment.name}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Activity Type</label>
          <select
            name="activityTypeId"
            defaultValue={assessment.activityTypeId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Assessor</label>
          <select
            name="assessorId"
            defaultValue={assessment.assessorId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Start Date</label>
          <input
            name="startDate"
            type="date"
            defaultValue={toDateInput(assessment.startDate)}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">End Date</label>
          <input
            name="endDate"
            type="date"
            defaultValue={toDateInput(assessment.endDate)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Line of Assurance</label>
          <select
            name="loa"
            defaultValue={assessment.loa}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {loaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select
            name="status"
            defaultValue={assessment.status}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Controls Section - Multi-Select with Filters */}
        <div className="col-span-2 border-t border-slate-200 pt-4 mt-4">
          <h3 className="font-medium text-slate-900 mb-3">Controls</h3>

          {/* Filter & Selection Interface */}
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600 uppercase block mb-2">Add or Remove Controls</label>
          </div>

          <ControlsSelectorWrapper
            key={`selector-${assignmentsKey}`}
            assessmentId={assessment.id}
            initialSelectedIds={assessment.controlAssignments.map(ac => ac.controlId)}
          />

          {/* Currently Assigned Controls Table (Effective editable, Unassign) */}
          <AssignedControlsTable
            key={`assigned-${assignmentsKey}`}
            initialAssignments={assessment.controlAssignments}
          />
        </div>

        <div className="col-span-2">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Save changes
          </button>
        </div>
      </form>

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
