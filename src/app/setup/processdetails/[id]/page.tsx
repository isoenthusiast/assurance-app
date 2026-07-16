import { prisma } from "@/lib/prisma";
import { getSelectedCompanyId } from "@/lib/company-context";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import ProcessDetailsClient from "./ProcessDetailsClient";

export default async function ProcessDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const currentUserName = session?.user?.name || null;
  const currentUserRole = (session?.user as any)?.role || null;
  const companyId = await getSelectedCompanyId();

  const processArea = await prisma.processArea.findUnique({
    where: { id, ...(companyId ? { companyId } : {}) },
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

  // All controls come through the junction table now
  const mergedSubProcesses = subProcesses.map((sp) => {
    return {
      ...sp,
      controls: sp.controlSubProcesses
        .map((csp) => csp.control)
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  // --- Requirements linked to this process area (fetch first to get their control IDs) ---
  const requirements = await prisma.requirement.findMany({
    where: { processAreaId: id },
    orderBy: { requirementId: "asc" },
    include: {
      controlMappings: {
        select: { controlId: true },
      },
    },
  });

  // Fetch "Unmapped Controls" requirement for the same standard+company, even if on a different PA
  const unmappedReq = companyId
    ? await prisma.requirement.findFirst({
        where: {
          requirementId: "Unmapped Controls",
          standard: processArea.standard,
          companyId,
          processAreaId: { not: id }, // exclude if already fetched above
        },
        include: {
          controlMappings: { select: { controlId: true } },
        },
      })
    : null;

  // Merge unmapped controls requirement into the list (if found and not already present)
  const allRequirements = unmappedReq
    ? [...requirements, unmappedReq]
    : requirements;

  // Collect ALL control IDs: from subprocesses AND from requirement mappings
  const spControlIds = mergedSubProcesses.flatMap((sp) => sp.controls.map((c) => c.id));
  const reqControlIds = allRequirements.flatMap((r) => r.controlMappings.map((m) => m.controlId));
  const allControlIds = [...new Set([...spControlIds, ...reqControlIds])];

  // --- Assessments that use controls from this process area ---
  const controlAssignments = await prisma.controlAssignment.findMany({
    where: { controlId: { in: allControlIds } },
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
        include: { 
          actions: { orderBy: { createdDate: "asc" } },
          _count: { select: { actions: true } },
        },
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
  const totalControls = spControlIds.length;
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

  // Sample stats — "Tested AND controlEffective" = effective
  const totalSamples = assessments.reduce((sum, a) => sum + a.samples.length, 0);
  const testedSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.status === "Tested").length, 0);
  const effectiveSamples = assessments.reduce((sum, a) => sum + a.samples.filter((s) => s.status === "Tested" && s.controlEffective).length, 0);

  // Calculate health per requirement: % of linked controls that are effective
  // (requirements already fetched above with controlMappings; controlAssignments now covers all their control IDs)
  const requirementStats = allRequirements.map((req) => {
    const linkedControlIds = req.controlMappings.map((m) => m.controlId);
    const linkedAssignments = controlAssignments.filter((ca) =>
      linkedControlIds.includes(ca.controlId)
    );
    const effectiveLinked = linkedAssignments.filter((ca) => ca.effective === "Effective").length;
    const totalLinked = linkedControlIds.length;
    const healthPct = totalLinked > 0 ? Math.round((effectiveLinked / totalLinked) * 100) : 0;
    return {
      rId: req.rId,
      requirementId: req.requirementId,
      clauseContent: req.clauseContent,
      totalLinkedControls: totalLinked,
      effectiveControls: effectiveLinked,
      healthPct,
    };
  });

  // --- Knowledgebase entries for this process area (filtered by companyId) ---
  // Use raw SQL — Prisma 7.8 does not expose knowledgebase delegate at runtime
  const kbEntriesRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "kID", "knowledgeName", "knowledgeContent", "remarks", "createdDate", "addedBy", "companyId", "processAreaId"
     FROM "Knowledgebase"
     WHERE "processAreaId" = $1${companyId ? ` AND "companyId" = '${companyId}'` : ''}
     ORDER BY "createdDate" DESC`,
    id
  );
  const kbEntries = kbEntriesRaw.map((e: any) => ({
    kID: e.kID,
    knowledgeName: e.knowledgeName,
    knowledgeContent: e.knowledgeContent,
    remarks: e.remarks,
    createdDate: e.createdDate instanceof Date ? e.createdDate.toISOString() : String(e.createdDate),
    addedBy: e.addedBy,
    companyId: e.companyId,
    processAreaId: e.processAreaId,
  }));

  // --- Requirements with full control data (for Tab 2: Requirements & Controls) ---
  const requirementsWithControls = await prisma.requirement.findMany({
    where: { processAreaId: id },
    orderBy: { requirementId: "asc" },
    include: {
      controlMappings: {
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

  // Also fetch Unmapped Controls with full control data, if on a different PA
  const unmappedWithControls = unmappedReq
    ? await prisma.requirement.findUnique({
        where: { rId: unmappedReq.rId },
        include: {
          controlMappings: {
            include: {
              control: {
                include: { _count: { select: { controlAssignments: true } } },
              },
            },
          },
        },
      })
    : null;

  const allReqsWithControls = unmappedWithControls
    ? [...requirementsWithControls, unmappedWithControls]
    : requirementsWithControls;

  const reqWithControls = allReqsWithControls.map((req) => ({
    rId: req.rId,
    requirementId: req.requirementId,
    clauseContent: req.clauseContent,
    controls: req.controlMappings
      .map((m) => m.control)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  // Effectiveness stats — based on subprocess-linked controls (the PA's control set)
  const spAssignments = controlAssignments.filter((ca) => spControlIds.includes(ca.controlId));
  const effectiveCount = spAssignments.filter((ca) => ca.effective === "Effective").length;
  const notEffectiveCount = spAssignments.filter((ca) => ca.effective === "NotEffective").length;
  const neverTestedCount = totalControls - (effectiveCount + notEffectiveCount);

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
      requirementStats={requirementStats}
      reqWithControls={reqWithControls}
      currentUserName={currentUserName}
      currentUserRole={currentUserRole}
      companyId={companyId}
      kbEntries={kbEntries}
    />
  );
}
