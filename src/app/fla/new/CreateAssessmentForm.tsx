"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import UserSearchSelect from "@/components/UserSearchSelect";

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CreateAssessmentForm({ activityTypes, users, loaOptions, currentUserId }: any) {
  const router = useRouter();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const durationRef = useRef(0); // days gap between start and end
  const [selectedPA, setSelectedPA] = useState("all");
  const [selectedSP, setSelectedSP] = useState("all");
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());

  // These will be populated from client-side fetch
  const [controls, setControls] = useState<any[]>([]);
  const [processAreas, setProcessAreas] = useState<any[]>([]);
  const [subProcesses, setSubProcesses] = useState<any[]>([]);

  useState(() => {
    fetch("/api/admin/table/Control/data").then(r => r.json()).then(d => setControls(d.rows || [])).catch(() => {});
    fetch("/api/admin/table/ProcessArea/data").then(r => r.json()).then(d => setProcessAreas(d.rows || [])).catch(() => {});
    fetch("/api/admin/table/SubProcess/data").then(r => r.json()).then(d => setSubProcesses(d.rows || [])).catch(() => {});
  });

  const filteredControls = controls.filter((c: any) => {
    if (selectedPA !== "all" && c.processAreaId !== selectedPA) return false;
    if (selectedSP !== "all" && c.subProcessId !== selectedSP) return false;
    return true;
  });

  const toggleControl = (id: string) => {
    const next = new Set(selectedControls);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedControls(next);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, any> = {
      name: fd.get("name")?.toString() ?? "",
      activityTypeId: fd.get("activityTypeId")?.toString() ?? "",
      assessorId: fd.get("assessorId")?.toString() ?? "",
      startDate: fd.get("startDate")?.toString() ?? new Date().toISOString().slice(0, 10),
      loa: fd.get("loa")?.toString() ?? "FirstLine",
      status: "Planned",
      controlIds: Array.from(selectedControls),
    };
    const endDate = fd.get("endDate")?.toString();
    if (endDate) data.endDate = endDate;

    const res = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create assessment");
    const result = await res.json();
    router.push(`/fla/${result.id}`);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Name */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Assessment Name</label>
        <input name="name" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>

      {/* Activity Type + Assessor row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Activity Type</label>
          <select name="activityTypeId" required className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            <option value="">Select…</option>
            {activityTypes.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Assessor</label>
          <UserSearchSelect name="assessorId" users={users} defaultValue={currentUserId} required />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Start Date</label>
          <input name="startDate" type="date" required defaultValue={todayStr}
            onChange={e => {
              const newStart = e.target.value;
              setStartDate(newStart);
              // Shift end date by the same duration; if no end date, default to start
              if (!endDate) {
                setEndDate(newStart);
                durationRef.current = 0;
              } else {
                setEndDate(addDays(newStart, durationRef.current));
              }
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">End Date</label>
          <input name="endDate" type="date" value={endDate}
            onChange={e => {
              const newEnd = e.target.value;
              setEndDate(newEnd);
              if (newEnd) {
                durationRef.current = daysBetween(startDate, newEnd);
              }
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {/* LOA */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Line of Assurance</label>
        <select name="loa" className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          {loaOptions.map((o: any) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Control Selection */}
      <div className="space-y-2 rounded border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900">Controls</h3>

        <div className="flex gap-3">
          <select value={selectedPA} onChange={e => setSelectedPA(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="all">All Process Areas</option>
            {processAreas.map((pa: any) => (
              <option key={pa.id} value={pa.id}>{pa.name}</option>
            ))}
          </select>
          <select value={selectedSP} onChange={e => setSelectedSP(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm">
            <option value="all">All Sub-Processes</option>
            {subProcesses.filter((sp: any) => selectedPA === "all" || sp.processAreaId === selectedPA).map((sp: any) => (
              <option key={sp.id} value={sp.id}>{sp.name}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500">Selected: {selectedControls.size} controls</p>

        <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
          {filteredControls.map((c: any) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedControls.has(c.id)} onChange={() => toggleControl(c.id)} className="h-4 w-4" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
        Create Assessment
      </button>
    </form>
  );
}
