import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProcessDetailsClient from "./ProcessDetailsClient";

export default async function ProcessDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const processArea = await prisma.processArea.findUnique({
    where: { id },
    include: {
      _count: { select: { subProcesses: true, controls: true } },
    },
  });

  if (!processArea) notFound();

  // --- Sub-processes & Controls (primary + junction-linked) ---
  const subProcesses = await prisma.subProcess.findMany({
    where: { processAreaId: id },
    orderBy: { name: "asc" },
    include: {
      controls: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { controlAssignments: true } },
        },
      },
      controlSubProcesses: {
        include: {
          control: {
            include: {
              _count: { select: { controlAssignments: true } },
            },
          },
        },
      },
    },
  });

  // Merge junction-linked controls into each sub-process's control list,
  // deduplicating by control ID (primary link wins on duplicate).
  const mergedSubProcesses = subProcesses.map((sp) => {
    const primaryIds = new Set(sp.controls.map((c) => c.id));
    const junctionControls = sp.controlSubProcesses
      .map((csp) => csp.control)
      .filter((c) => !primaryIds.has(c.id));
    return {
      ...sp,
      controls: [...sp.controls, ...junctionControls].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  });

  // --- Assessments that use controls from this process area ---
  const controlIds = mergedSubProcesses.flatMap((sp) => sp.controls.map((c) => c.id));

  const controlAssignments = await prisma.controlAssignment.findMany({
    where: { controlId: { in: controlIds } },
    select: { assessmentId: true, effective: true, controlId: true },
  });

  const assessmentIds = [...new Set(controlAssignments.map((ca) => ca.assessmentId))];

  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    orderBy: { startDate: "desc" },
    include: {
      activityType: true,
      assessor: true,
      samples: true,
      findings: {
        include: { _count: { select: { actions: true } } },
      },
    },
  });

  // Build assessment → controls mapping
  const controlsByAssessment = new Map<string, { controlId: string; effective: string | null }[]>();
  for (const ca of controlAssignments) {
    const list = controlsByAssessment.get(ca.assessmentId) ?? [];
    list.push({ controlId: ca.controlId, effective: ca.effective });
    controlsByAssessment.set(ca.assessmentId, list);
  }

  // --- Stats for overview ---
  const totalControls = controlIds.length;
  const totalAssessments = assessments.length;
  const plannedAssessments = assessments.filter((a) => a.status === "Planned").length;
  const completedAssessments = assessments.filter((a) => a.status === "Completed" || a.status === "InProgress").length;
  const totalSamples = assessments.reduce((sum, a) => sum + a.samples.length, 0);
  const testedSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.status === "Tested").length, 0);
  const failedSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.conclusion === "Fail").length, 0);
  const totalFindings = assessments.reduce((sum, a) => sum + a.findings.length, 0);
  const totalActions = assessments.reduce(
    (sum, a) => sum + a.findings.reduce((s, f) => s + f._count.actions, 0),
    0
  );

  // Effectiveness stats
  const effectiveCount = controlAssignments.filter((ca) => ca.effective === "Effective").length;
  const notEffectiveCount = controlAssignments.filter((ca) => ca.effective === "NotEffective").length;
  const notAssessedCount = controlAssignments.filter((ca) => ca.effective === null).length;

  const overviewStats = {
    totalControls,
    totalAssessments,
    plannedAssessments,
    completedAssessments,
    totalSamples,
    testedSamples,
    failedSamples,
    totalFindings,
    totalActions,
    effectiveCount,
    notEffectiveCount,
    notAssessedCount,
  };

  return (
    <ProcessDetailsClient
      processArea={processArea}
      subProcesses={mergedSubProcesses}
      assessments={assessments}
      controlsByAssessment={controlsByAssessment}
      overviewStats={overviewStats}
      allControls={mergedSubProcesses.flatMap((sp) => sp.controls)}
    />
  );
}
