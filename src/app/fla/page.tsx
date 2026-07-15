import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSelectedCompanyId } from "@/lib/company-context";
import { GamificationDashboard } from "@/components/GamificationDashboard";
import ProcessHealthDashboard from "./ProcessHealthDashboard";

export const dynamic = "force-dynamic";

export default async function FlaDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = await getSelectedCompanyId();

  // Compute process health: average rawHealthScore across all controls
  // linked to subprocesses under each process area, grouped by Standard table.
  const rawHealth = await prisma.$queryRawUnsafe<
    Array<{ processAreaId: string; processAreaName: string; standard: string; avgHealth: number; controlCount: number }>
  >(`
    SELECT
      pa."id" AS "processAreaId",
      pa."name" AS "processAreaName",
      COALESCE(s."standard", pa."standard", 'Uncategorized') AS "standard",
      ROUND(AVG(c."rawHealthScore")::numeric, 1) AS "avgHealth",
      COUNT(DISTINCT c."id")::int AS "controlCount"
    FROM "ProcessArea" pa
    LEFT JOIN "Standard" s ON s."id" = pa."StandardID"
    LEFT JOIN "SubProcess" sp ON sp."processAreaId" = pa."id"
    LEFT JOIN "ControlSubProcess" csp ON csp."subProcessId" = sp."id"
    LEFT JOIN "Control" c ON c."id" = csp."controlId" AND c."rawHealthScore" IS NOT NULL
    ${companyId ? `WHERE pa."companyId" = '${companyId}'` : ''}
    GROUP BY pa."id", pa."name", s."standard", s."sequenceNo", pa."standard"
    ORDER BY COALESCE(s."sequenceNo", 999), s."standard", pa."standard", "avgHealth" ASC
  `);

  const processHealth = rawHealth.map((r) => ({
    processAreaId: r.processAreaId,
    processAreaName: r.processAreaName,
    standard: r.standard,
    avgHealth: Number(r.avgHealth),
    controlCount: Number(r.controlCount),
  }));

  // Fetch assessments in progress with sample counts
  const inProgressAssessments = await prisma.assessment.findMany({
    where: { status: { not: "Completed" }, ...(companyId ? { companyId } : {}) },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { samples: true } },
      samples: { select: { status: true } },
    },
  });

  const assessmentsInProgress = inProgressAssessments.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    startDate: a.startDate,
    totalSamples: a._count.samples,
    testedSamples: a.samples.filter((s) => s.status === "Tested").length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Assurance Management Dashboard</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2">
          <ProcessHealthDashboard processes={processHealth} assessments={assessmentsInProgress} />
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
