import { auth } from "@/auth";
import { GamificationDashboard } from "@/components/GamificationDashboard";

export const dynamic = "force-dynamic";

export default async function FlaDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Assurance Management Dashboard</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2" />

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
