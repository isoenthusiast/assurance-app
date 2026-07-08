import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
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
  const completedAssessments = assessments.filter((a) => a.status === "Completed").length;
  const totalFindings = assessments.reduce((sum, a) => sum + a.findings.length, 0);

  // Action stats — fetch all actions linked to this process area's controls
  const findingIds = assessments.flatMap((a) => a.findings.map((f) => f.id));
  const actions = await prisma.action.findMany({
    where: { findingId: { in: findingIds } },
    select: { actionClosureEffective: true },
  });
  const totalActions = actions.length;
  const completedActions = actions.filter((a) => a.actionClosureEffective).length;

  // Sample stats
  const totalSamples = assessments.reduce((sum, a) => sum + a.samples.length, 0);
  const testedSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.status === "Tested").length, 0);
  const effectiveSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.conclusion === "Effective").length, 0);

  // Effectiveness stats — "never tested" controls are not effective
  const effectiveCount = controlAssignments.filter((ca) => ca.effective === "Effective").length;
  const notEffectiveCount = controlAssignments.filter((ca) => ca.effective === "NotEffective").length;
  const neverTestedCount = totalControls - (effectiveCount + notEffectiveCount); // controls never assigned

  const overviewStats = {
    totalControls,
    effectiveControls: effectiveCount,
    totalAssessments,
    completedAssessments,
    totalFindings,
    totalActions,
    completedActions,
    effectiveCount,
    notEffectiveCount,
    neverTestedCount,
    totalSamples,
    testedSamples,
    effectiveSamples,
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
