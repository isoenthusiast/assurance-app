import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { deleteProcessArea } from "./actions";
import { deleteSubProcess } from "../sub-processes/actions";
import ProcessAreasClient from "./ProcessAreasClient";

// Preferred display order for standards. Items not in this list are appended
// alphabetically. "International Standards (ISO)" is intentionally placed
// after the domain-specific standards.
const STANDARD_ORDER = [
  "Carbon, Environment, Social Performance, Product Stewardship & Quality",
  "HSSE & SP and Asset Management Foundations",
  "Process Safety & Asset Management",
  "Transport Safety",
  "Workplace Health, Safety & Security",
  "International Standards (ISO)",
];

function sortStandards(standards: string[]): string[] {
  const orderMap = new Map(STANDARD_ORDER.map((s, i) => [s, i]));
  return [...standards].sort((a, b) => {
    const ai = orderMap.get(a);
    const bi = orderMap.get(b);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return a.localeCompare(b);
  });
}

export default async function ProcessAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [areas, editing, allAreas, subProcesses, requirements, testedAssignments] = await Promise.all([
    prisma.processArea.findMany({
      orderBy: { pId: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        pId: true,
        standard: true,
        _count: { select: { subProcesses: true, controls: true, requirements: true } },
      },
    }),
    edit ? prisma.processArea.findUnique({ where: { id: edit } }) : Promise.resolve(null),
    prisma.processArea.findMany({
      select: { standard: true },
      where: { standard: { not: null } },
      distinct: ['standard'],
      orderBy: { standard: 'asc' },
    }),
    // Fetched up front (not per-expand) so expanding a row is instant — the
    // table just filters this list by processAreaId client-side.
    prisma.subProcess.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        processAreaId: true,
        _count: { select: { controlSubProcesses: true } },
      },
    }),
    // Requirements with linked controls (via MapControl2Requirement)
    prisma.requirement.findMany({
      orderBy: { requirementId: "asc" },
      select: {
        rId: true,
        requirementId: true,
        clauseContent: true,
        intentOutcome: true,
        clauseApplicability: true,
        references: true,
        applicable: true,
        standard: true,
        pId: true,
        processAreaId: true,
        _count: { select: { controlMappings: true } },
        controlMappings: {
          select: {
            control: {
              select: {
                id: true,
                name: true,
                controlType: true,
                controlRef: true,
                isHsseCritical: true,
                ramRating: true,
                rawHealthScore: true,
                lastTestedDate: true,
                lastTestResult: true,
                _count: { select: { controlAssignments: true } },
              },
            },
          },
        },
      },
    }),
    // Every control assignment belonging to a *completed* assessment (i.e.
    // one that actually tested the control), used below to count distinct
    // assessments per sub-process.
    prisma.controlAssignment.findMany({
      where: { assessment: { endDate: { not: null } } },
      select: { assessmentId: true, control: { select: { controlSubProcesses: { select: { subProcessId: true } } } } },
    }),
  ]);

  // Get unique standards in custom display order
  const uniqueStandards = sortStandards(
    allAreas
      .map((pa) => pa.standard)
      .filter((s) => s !== null)
  ) as string[];

  // Distinct assessment ids per sub-process — "assessments that tested the
  // controls in this sub-process".
  const assessmentIdsBySubProcess = new Map<string, Set<string>>();
  for (const ca of testedAssignments) {
    for (const csp of (ca.control.controlSubProcesses || [])) {
      const subProcessId = csp.subProcessId;
      const set = assessmentIdsBySubProcess.get(subProcessId) ?? new Set<string>();
      set.add(ca.assessmentId);
      assessmentIdsBySubProcess.set(subProcessId, set);
    }
  }

  // Pull the actual assessment records (title, end date, status, findings /
  // actions counts) for every assessment referenced above, so the
  // sub-process row's "Assessments" expand panel doesn't need a per-row
  // fetch.
  const allAssessmentIds = Array.from(
    new Set(Array.from(assessmentIdsBySubProcess.values()).flatMap((set) => Array.from(set)))
  );
  const assessmentRecords = await prisma.assessment.findMany({
    where: { id: { in: allAssessmentIds } },
    select: {
      id: true,
      name: true,
      endDate: true,
      status: true,
      _count: { select: { findings: true } },
      findings: { select: { _count: { select: { actions: true } } } },
    },
  });
  const assessmentDetailsById = new Map(
    assessmentRecords.map((a) => [
      a.id,
      {
        id: a.id,
        name: a.name,
        endDate: a.endDate,
        status: a.status,
        findingsCount: a._count.findings,
        actionsCount: a.findings.reduce((sum, f) => sum + f._count.actions, 0),
      },
    ])
  );

  const subProcessesWithAssessmentCounts = subProcesses.map((sp) => {
    const totalControls = sp._count.controlSubProcesses;
    const assessments = Array.from(assessmentIdsBySubProcess.get(sp.id) ?? [])
      .map((id) => assessmentDetailsById.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .sort((a, b) => {
        const aTime = a.endDate ? new Date(a.endDate).getTime() : 0;
        const bTime = b.endDate ? new Date(b.endDate).getTime() : 0;
        return bTime - aTime;
      });

    return { ...sp, _count: { controlSubProcesses: totalControls }, assessmentCount: assessments.length, assessments };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Process Areas</h1>
      <p className="mt-1 text-sm text-slate-500">
        The work processes (Abilities) that Requirements and Controls roll up under — e.g. ESP, AIPSM, MAC.
      </p>

      {/* Keyed on the editing target so the add/edit form modal fully
          remounts (and re-derives its open/closed state) whenever the user
          switches between "Add" and "Edit <area>", or between editing two
          different process areas. */}
      <ProcessAreasClient
        key={editing?.id ?? "new"}
        areas={areas}
        standards={uniqueStandards}
        deleteAction={deleteProcessArea}
        subProcesses={subProcessesWithAssessmentCounts}
        requirements={requirements}
        deleteSubProcessAction={deleteSubProcess}
        editing={editing}
      />
    </div>
  );
}
