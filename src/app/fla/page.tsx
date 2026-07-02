import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/auth";
import { GamificationDashboard } from "@/components/GamificationDashboard";

const statusStyles: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700",
  InProgress: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default async function FlaDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const assessments = await prisma.assessment.findMany({
    orderBy: { startDate: "desc" },
    include: {
      activityType: true,
      assessor: true,
      samples: true,
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assurance Activities</h1>
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
        <div className="col-span-2 space-y-3">
        {assessments.map((a) => {
          const total = a.samples.length;
          const tested = a.samples.filter((s) => s.status === "Tested").length;
          const failed = a.samples.filter((s) => s.conclusion === "Fail").length;
          const pct = total === 0 ? 0 : Math.round((tested / total) * 100);

          return (
            <Link
              key={a.id}
              href={`/fla/${a.id}`}
              className="block rounded border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{a.name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[a.status]}`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {a.activityType.name} · {a.assessor.name} · {a.startDate.toLocaleDateString()}
                    {a.endDate ? ` – ${a.endDate.toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div className="w-40 text-right">
                  <div className="text-sm text-slate-600">
                    {tested}/{total} sampled{failed > 0 ? ` · ${failed} fail` : ""}
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${failed > 0 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

          {assessments.length === 0 && (
            <p className="rounded border border-slate-200 bg-white px-4 py-6 text-center text-slate-400">
              No assurance activities planned yet.
            </p>
          )}
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
