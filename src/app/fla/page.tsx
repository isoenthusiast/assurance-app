import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/auth";
import { GamificationDashboard } from "@/components/GamificationDashboard";
import FlaDashboardClient from "./FlaDashboardClient";

// Preferred display order for standards.
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

export default async function FlaDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch assessments with control assignments for filtering
  const rawAssessments = await prisma.assessment.findMany({
    orderBy: { startDate: "desc" },
    include: {
      activityType: true,
      assessor: true,
      samples: true,
      controlAssignments: {
        include: {
          control: {
            include: {
              processArea: { select: { id: true, standard: true } },
              subProcess: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  // Flatten: each assessment gets the standard/processArea/subProcess from
  // its first control assignment (for filtering purposes).
  const assessments = rawAssessments.map((a) => {
    const firstControl = a.controlAssignments[0]?.control;
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      startDate: a.startDate.toISOString(),
      endDate: a.endDate?.toISOString() ?? null,
      activityType: { name: a.activityType.name },
      assessor: { id: a.assessor.id, name: a.assessor.name },
      samples: a.samples.map((s) => ({
        status: s.status,
        conclusion: s.conclusion,
      })),
      standard: firstControl?.processArea?.standard ?? null,
      processAreaId: firstControl?.processArea?.id ?? null,
      subProcessId: firstControl?.subProcess?.id ?? null,
    };
  });

  // Fetch filter options
  const [allStandards, allProcessAreas, allSubProcesses] = await Promise.all([
    prisma.processArea.findMany({
      select: { standard: true },
      where: { standard: { not: null } },
      distinct: ["standard"],
      orderBy: { standard: "asc" },
    }),
    prisma.processArea.findMany({
      select: { id: true, name: true, standard: true },
      orderBy: { name: "asc" },
    }),
    prisma.subProcess.findMany({
      select: { id: true, name: true, processAreaId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const standards = sortStandards(
    allStandards.map((s) => s.standard!).filter(Boolean)
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plan and track Front Line Assurances and other assurance activities.
          </p>
        </div>
        <Link
          href="/admin/assessments/new"
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Plan Assessment
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2">
          <FlaDashboardClient
            assessments={assessments}
            standards={standards}
            processAreas={allProcessAreas}
            subProcesses={allSubProcesses}
            userId={userId}
          />
        </div>

        {/* Gamification Sidebar */}
        <aside>
          {userId ? (
            <GamificationDashboard userId={userId} />
          ) : (
            <div className="rounded border border-slate-200 bg-white p-4 text-center">
              <p className="text-sm text-slate-500">Sign in to see your progress</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
