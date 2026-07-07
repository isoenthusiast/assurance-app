"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SubProcess = { id: string; name: string; processAreaId: string };
type ProcessArea = { id: string; name: string };

type Editing = {
  id: string;
  name: string;
  statement: string;
  controlType: string;
  processAreaId: string;
  subProcessId: string;
  isHsseCritical: boolean;
  ramRating: string | null;
  riskWeight: number;
  sourceFile?: string | null;
  controlRef?: string | null;
  practiceDocument?: string | null;
  controlTypeDetail?: string | null;
  csfWho?: string | null;
  csfWhat?: string | null;
  csfWhen?: string | null;
  csfWhere?: string | null;
  csfWhy?: string | null;
  csfHow?: string | null;
  csfEvidence?: string | null;
  keyActivities?: string | null;
  riskAddressed?: string | null;
  testingApproach?: string | null;
  uncertainFlags?: string | null;
  rawHealthScore?: number | null;
  lastTestedDate?: string | Date | null;
  lastTestResult?: string | null;
} | null;

const controlTypes = ["Administrative", "Procedural", "Analytical", "Behavioral", "Informational", "Engineering"];
const ramOptions = ["Red", "Yellow5A", "Yellow5B", "Yellow", "Blue"];

export default function ControlForm({
  processAreas,
  subProcesses,
  editing,
}: {
  processAreas: ProcessArea[];
  subProcesses: SubProcess[];
  editing: Editing;
}) {
  const [processAreaId, setProcessAreaId] = useState(
    editing?.processAreaId ?? processAreas[0]?.id ?? ""
  );
  // Opens automatically when arriving via the "Edit" link (editing !== null).
  // Otherwise starts closed behind a "+ Add Control" trigger button.
  const [isOpen, setIsOpen] = useState(Boolean(editing));

  const filteredSubProcesses = subProcesses.filter((sp) => sp.processAreaId === processAreaId);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = fd.get("id")?.toString();
    const data: Record<string, any> = {
      name: fd.get("name")?.toString() ?? "",
      statement: fd.get("statement")?.toString() ?? "",
      controlType: fd.get("controlType")?.toString(),
      processAreaId: fd.get("processAreaId")?.toString() ?? "",
      subProcessId: fd.get("subProcessId")?.toString() ?? "",
      isHsseCritical: fd.get("isHsseCritical") === "on",
      ramRating: fd.get("ramRating")?.toString() || null,
      riskWeight: parseInt(fd.get("riskWeight")?.toString() || "1"),
      sourceFile: fd.get("sourceFile")?.toString() || null,
      controlRef: fd.get("controlRef")?.toString() || null,
      practiceDocument: fd.get("practiceDocument")?.toString() || null,
      controlTypeDetail: fd.get("controlTypeDetail")?.toString() || null,
      csfWho: fd.get("csfWho")?.toString() || null,
      csfWhat: fd.get("csfWhat")?.toString() || null,
      csfWhen: fd.get("csfWhen")?.toString() || null,
      csfWhere: fd.get("csfWhere")?.toString() || null,
      csfWhy: fd.get("csfWhy")?.toString() || null,
      csfHow: fd.get("csfHow")?.toString() || null,
      csfEvidence: fd.get("csfEvidence")?.toString() || null,
      keyActivities: fd.get("keyActivities")?.toString() || null,
      riskAddressed: fd.get("riskAddressed")?.toString() || null,
      testingApproach: fd.get("testingApproach")?.toString() || null,
      uncertainFlags: fd.get("uncertainFlags")?.toString() || null,
      rawHealthScore: parseInt(fd.get("rawHealthScore")?.toString() || "80"),
      lastTestedDate: fd.get("lastTestedDate")?.toString() || null,
      lastTestResult: fd.get("lastTestResult")?.toString() || null,
    };

    const endpoint = id ? `/api/admin/table/Control/${id}` : "/api/admin/table/Control";
    const res = await fetch(endpoint, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save control");
    router.refresh();
    router.push("/setup/controls");
  };

  if (!isOpen) {
    return (
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Add Control
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !editing) setIsOpen(false);
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-4xl space-y-6 rounded border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{editing ? "Edit Control" : "Add Control"}</h2>
          {editing ? (
            <Link
              href="/setup/controls"
              className="text-xl leading-none text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xl leading-none text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        {editing && <input type="hidden" name="id" value={editing.id} />}

      {/* BASIC INFORMATION */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Basic Information</legend>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name *</label>
          <input
            name="name"
            defaultValue={editing?.name ?? ""}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Control Statement *</label>
          <textarea
            name="statement"
            defaultValue={editing?.statement ?? ""}
            required
            rows={3}
            placeholder="What should be true if this control is working?"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {/* CLASSIFICATION */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Classification</legend>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Process Area *</label>
            <select
              name="processAreaId"
              value={processAreaId}
              onChange={(e) => setProcessAreaId(e.target.value)}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {processAreas.map((pa) => (
                <option key={pa.id} value={pa.id}>
                  {pa.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Sub-Process *</label>
            <select
              name="subProcessId"
              defaultValue={editing?.subProcessId ?? ""}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select...
              </option>
              {filteredSubProcesses.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Control Type *</label>
            <select
              name="controlType"
              defaultValue={editing?.controlType ?? ""}
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="" disabled>
                Select a control type...
              </option>
              {controlTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Control Type Detail</label>
            <input
              name="controlTypeDetail"
              defaultValue={editing?.controlTypeDetail ?? ""}
              placeholder="Additional detail"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* SOURCE INFORMATION */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Source Information</legend>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Source File</label>
            <input
              name="sourceFile"
              defaultValue={editing?.sourceFile ?? ""}
              placeholder="e.g., 01 AIPSM"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Control Reference</label>
            <input
              name="controlRef"
              defaultValue={editing?.controlRef ?? ""}
              placeholder="e.g., AIPSM-PHA-001"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Practice Document</label>
            <input
              name="practiceDocument"
              defaultValue={editing?.practiceDocument ?? ""}
              placeholder="e.g., SEAM_Practice.md"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      {/* CRITICAL SUCCESS FACTORS (CSF) */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Critical Success Factors (CSF)</legend>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Who (Responsibility)</label>
            <textarea
              name="csfWho"
              defaultValue={editing?.csfWho ?? ""}
              rows={2}
              placeholder="Roles and responsibilities"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">What (Activities)</label>
            <textarea
              name="csfWhat"
              defaultValue={editing?.csfWhat ?? ""}
              rows={2}
              placeholder="Key activities"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">When (Timing)</label>
            <textarea
              name="csfWhen"
              defaultValue={editing?.csfWhen ?? ""}
              rows={2}
              placeholder="Timing and frequency"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Where (Location)</label>
            <textarea
              name="csfWhere"
              defaultValue={editing?.csfWhere ?? ""}
              rows={2}
              placeholder="Where control is executed"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Why (Rationale)</label>
            <textarea
              name="csfWhy"
              defaultValue={editing?.csfWhy ?? ""}
              rows={2}
              placeholder="Business rationale"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">How (Method)</label>
            <textarea
              name="csfHow"
              defaultValue={editing?.csfHow ?? ""}
              rows={2}
              placeholder="How control is executed"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Evidence</label>
          <textarea
            name="csfEvidence"
            defaultValue={editing?.csfEvidence ?? ""}
            rows={2}
            placeholder="What evidence demonstrates compliance"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {/* EXECUTION DETAILS */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Execution Details</legend>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Key Activities</label>
          <textarea
            name="keyActivities"
            defaultValue={editing?.keyActivities ?? ""}
            rows={2}
            placeholder="Pipe-delimited list: Activity 1 | Activity 2 | Activity 3"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Risk Addressed</label>
          <textarea
            name="riskAddressed"
            defaultValue={editing?.riskAddressed ?? ""}
            rows={2}
            placeholder="What risk or hazard this control addresses"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Testing Approach</label>
          <textarea
            name="testingApproach"
            defaultValue={editing?.testingApproach ?? ""}
            rows={2}
            placeholder="How to test this control"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Uncertain Flags</label>
          <textarea
            name="uncertainFlags"
            defaultValue={editing?.uncertainFlags ?? ""}
            rows={2}
            placeholder="Any uncertain or ambiguous items"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {/* RISK & ASSESSMENT */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Risk & Assessment</legend>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">RAM Rating</label>
            <select
              name="ramRating"
              defaultValue={editing?.ramRating ?? ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">N/A</option>
              {ramOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Risk Weight</label>
            <input
              name="riskWeight"
              type="number"
              min={1}
              defaultValue={editing?.riskWeight ?? 1}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Health Score</label>
            <input
              name="rawHealthScore"
              type="number"
              min={0}
              max={100}
              defaultValue={editing?.rawHealthScore ?? 80}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isHsseCritical"
              defaultChecked={editing?.isHsseCritical ?? false}
              className="h-4 w-4 rounded border-slate-300"
            />
            HSSE Critical
          </label>
        </div>
      </fieldset>

      {/* TESTING HISTORY */}
      <fieldset className="space-y-3 border-b border-slate-200 pb-6">
        <legend className="text-sm font-semibold text-slate-700">Testing History</legend>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Last Tested Date</label>
            <input
              name="lastTestedDate"
              type="date"
              defaultValue={editing?.lastTestedDate ? (typeof editing.lastTestedDate === 'string' ? editing.lastTestedDate.split('T')[0] : editing.lastTestedDate.toISOString().split('T')[0]) : ""}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Last Test Result</label>
            <input
              name="lastTestResult"
              defaultValue={editing?.lastTestResult ?? ""}
              placeholder="e.g., Pass, Fail, Partial"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

        {/* ACTIONS */}
        <div className="flex items-center gap-3 pt-3">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editing ? "Save changes" : "Add Control"}
          </button>
          {editing ? (
            <Link href="/setup/controls" className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm text-slate-500 hover:underline"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
