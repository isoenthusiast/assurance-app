import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GamificationDashboard } from "@/components/GamificationDashboard";
import ProcessHealthDashboard from "./ProcessHealthDashboard";

export const dynamic = "force-dynamic";

export default async function FlaDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Compute process health: average rawHealthScore across all controls
  // linked to subprocesses under each process area, grouped by standard.
  const rawHealth = await prisma.$queryRawUnsafe<
    Array<{ processAreaId: string; processAreaName: string; standard: string; avgHealth: number; controlCount: number }>
  >(`
    SELECT
      pa."id" AS "processAreaId",
      pa."name" AS "processAreaName",
      pa."standard",
      ROUND(AVG(c."rawHealthScore")::numeric, 1) AS "avgHealth",
      COUNT(DISTINCT c."id")::int AS "controlCount"
    FROM "ProcessArea" pa
    JOIN "SubProcess" sp ON sp."processAreaId" = pa."id"
    JOIN "ControlSubProcess" csp ON csp."subProcessId" = sp."id"
    JOIN "Control" c ON c."id" = csp."controlId"
    WHERE c."rawHealthScore" IS NOT NULL
    GROUP BY pa."id", pa."name", pa."standard"
    ORDER BY pa."standard", "avgHealth" ASC
  `);

  const processHealth = rawHealth.map((r) => ({
    processAreaId: r.processAreaId,
    processAreaName: r.processAreaName,
    standard: r.standard,
    avgHealth: Number(r.avgHealth),
    controlCount: Number(r.controlCount),
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Assurance Management Dashboard</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2">
          <ProcessHealthDashboard processes={processHealth} />
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
