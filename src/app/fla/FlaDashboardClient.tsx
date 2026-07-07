"use client";

import { useState, useMemo } from "react";
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
  samples: { status: string; conclusion: string }[];
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
  standards,
  processAreas,
  subProcesses,
  userId,
}: {
  assessments: Assessment[];
  standards: Standard[];
  processAreas: ProcessArea[];
  subProcesses: SubProcess[];
  userId: string | undefined;
}) {
  const [selectedStandard, setSelectedStandard] = useState<string>("");
  const [selectedProcessArea, setSelectedProcessArea] = useState<string>("");
  const [selectedSubProcess, setSelectedSubProcess] = useState<string>("");
  const [mineOnly, setMineOnly] = useState(false);

  // Derived: process areas for the selected standard
  const filteredProcessAreas = useMemo(() => {
    if (!selectedStandard) return processAreas;
    return processAreas.filter((pa) => pa.standard === selectedStandard);
  }, [selectedStandard, processAreas]);

  // Derived: sub-processes for the selected process area
  const filteredSubProcesses = useMemo(() => {
    if (!selectedProcessArea) return subProcesses;
    return subProcesses.filter((sp) => sp.processAreaId === selectedProcessArea);
  }, [selectedProcessArea, subProcesses]);

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (selectedStandard && a.standard !== selectedStandard) return false;
      if (selectedProcessArea && a.processAreaId !== selectedProcessArea) return false;
      if (selectedSubProcess && a.subProcessId !== selectedSubProcess) return false;
      if (mineOnly && userId && a.assessor.id !== userId) return false;
      return true;
    });
  }, [assessments, selectedStandard, selectedProcessArea, selectedSubProcess, mineOnly, userId]);

  // When changing standard, reset the downstream selections
  const handleStandardChange = (std: string) => {
    setSelectedStandard(std);
    setSelectedProcessArea("");
    setSelectedSubProcess("");
  };

  const handleProcessAreaChange = (paId: string) => {
    setSelectedProcessArea(paId);
    setSelectedSubProcess("");
  };

  return (
    <>
      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="mb-4 space-y-3">
        {/* Standards tabs */}
        <div className="rounded border border-slate-200 bg-white p-1">
          <nav className="flex items-stretch gap-1">
            <button
              onClick={() => handleStandardChange("")}
              className={`min-w-0 flex-1 rounded px-2 py-1.5 text-center text-sm ${
                selectedStandard === ""
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Standards
            </button>
            {standards.map((std) => (
              <button
                key={std}
                onClick={() => handleStandardChange(std)}
                className={`min-w-0 flex-1 rounded px-2 py-1.5 text-center text-sm leading-snug ${
                  selectedStandard === std
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {std}
              </button>
            ))}
          </nav>
        </div>

        {/* Process Area tabs (only when a standard is selected) */}
        {selectedStandard && filteredProcessAreas.length > 0 && (
          <div className="rounded border border-slate-200 bg-white p-1">
            <nav className="flex flex-wrap items-stretch gap-1">
              <button
                onClick={() => handleProcessAreaChange("")}
                className={`min-w-0 rounded px-2 py-1.5 text-center text-sm ${
                  selectedProcessArea === ""
                    ? "bg-slate-700 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Process Areas
              </button>
              {filteredProcessAreas.map((pa) => (
                <button
                  key={pa.id}
                  onClick={() => handleProcessAreaChange(pa.id)}
                  className={`min-w-0 rounded px-2 py-1.5 text-center text-sm ${
                    selectedProcessArea === pa.id
                      ? "bg-slate-700 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {pa.name}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Sub-Process tabs (only when a process area is selected) */}
        {selectedProcessArea && filteredSubProcesses.length > 0 && (
          <div className="rounded border border-slate-200 bg-white p-1">
            <nav className="flex flex-wrap items-stretch gap-1">
              <button
                onClick={() => setSelectedSubProcess("")}
                className={`min-w-0 rounded px-2 py-1.5 text-center text-sm ${
                  selectedSubProcess === ""
                    ? "bg-slate-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Sub-Processes
              </button>
              {filteredSubProcesses.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSubProcess(sp.id)}
                  className={`min-w-0 rounded px-2 py-1.5 text-center text-sm ${
                    selectedSubProcess === sp.id
                      ? "bg-slate-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {sp.name}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Mine Only checkbox */}
        {userId && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Mine Only
          </label>
        )}
      </div>

      {/* ── Assessment List ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredAssessments.map((a) => {
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

        {filteredAssessments.length === 0 && (
          <p className="rounded border border-slate-200 bg-white px-4 py-6 text-center text-slate-400">
            No assurance activities match the selected filters.
          </p>
        )}
      </div>
    </>
  );
}
