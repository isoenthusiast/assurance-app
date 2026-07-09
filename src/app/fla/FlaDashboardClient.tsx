"use client";

import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type Assessment = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string | null;
  activityType: { name: string };
  assessor: { id: string; name: string };
  samples: { status: string; conclusion: string | null }[];
  standard: string | null;
  processAreaId: string | null;
  subProcessId: string | null;
};

type Standard = string;

type ProcessArea = {
  id: string;
  name: string;
  standard: string | null;
};

type SubProcess = {
  id: string;
  name: string;
  processAreaId: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const statusStyles: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700",
  InProgress: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

// ── Component ──────────────────────────────────────────────────────────────

export default function FlaDashboardClient({
  assessments,
  userId,
}: {
  assessments: Assessment[];
  userId: string | undefined;
}) {

  return (
    <>
      {/* ── Assessment List ─────────────────────────────────────────── */}
      <div className="space-y-3">
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
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {a.activityType.name} · {a.assessor.name} · {formatDate(a.startDate)}
                    {a.endDate ? ` – ${formatDate(a.endDate)}` : ""}
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
            No assurance activities yet. Plan one to get started!
          </p>
        )}
      </div>
    </>
  );
}
