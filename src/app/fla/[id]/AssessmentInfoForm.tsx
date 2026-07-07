"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AssessmentInfoForm({ assessment, activityTypes, loaOptions, statusOptions }: any) {
  const router = useRouter();
  const [endDate, setEndDate] = useState(toDateInput(assessment.endDate));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, any> = {
      name: fd.get("name")?.toString() ?? "",
      activityTypeId: fd.get("activityTypeId")?.toString() ?? "",
      assessorId: fd.get("assessorId")?.toString() ?? "",
      startDate: fd.get("startDate")?.toString() ?? "",
      endDate: fd.get("endDate")?.toString() || null,
      loa: fd.get("loa")?.toString() ?? "FirstLine",
      status: fd.get("status")?.toString() ?? "Planned",
    };

    await fetch(`/api/admin/assessments/${assessment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  };

  function toDateInput(d: any) {
    return d ? new Date(d).toISOString().slice(0, 10) : "";
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-2 gap-3 rounded border border-slate-200 bg-white p-5">
      <input type="hidden" name="id" value={assessment.id} />
      <div className="col-span-2 space-y-1">
        <label className="text-sm font-medium text-slate-700">Name</label>
        <input name="name" defaultValue={assessment.name} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Activity Type</label>
        <select name="activityTypeId" defaultValue={assessment.activityTypeId} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          {activityTypes.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Assessor</label>
        <select name="assessorId" defaultValue={assessment.assessorId} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          {assessment._assessors?.map((u: any) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Start Date</label>
        <input name="startDate" type="date" defaultValue={toDateInput(assessment.startDate)} required
          onChange={e => { if (endDate < e.target.value) setEndDate(e.target.value); }}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">End Date</label>
        <input name="endDate" type="date" value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">LOA</label>
        <select name="loa" defaultValue={assessment.loa} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          {loaOptions.map((o: any) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Status</label>
        <select name="status" defaultValue={assessment.status} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
          {statusOptions.map((s: string) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2 pt-1">
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Save changes</button>
      </div>
    </form>
  );
}
