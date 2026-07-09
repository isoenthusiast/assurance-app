import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { GamificationDashboard } from "@/components/GamificationDashboard";
import FlaDashboardClient from "./FlaDashboardClient";

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
              controlSubProcesses: { select: { subProcess: { select: { id: true } } } },
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
      subProcessId: firstControl?.controlSubProcesses?.[0]?.subProcess?.id ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-end">
        <Link
          href="/setup/assessments/new"
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
