"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Sub-process creation uses fetch API directly (avoid server action host validation)

// ─── Types ───────────────────────────────────────────────────────────────────

type ProcessArea = {
  id: string;
  name: string;
  description: string | null;
  pId: string | null;
  standard: string | null;
  _count: { subProcesses: number; controls: number };
};

type ControlSummary = {
  id: string;
  name: string;
  statement: string;
  controlType: string;
  isHsseCritical: boolean;
  ramRating: string | null;
  riskWeight: number;
  rawHealthScore: number;
  lastTestedDate: Date | null;
  lastTestResult: string | null;
  subProcessId: string;
  _count: { controlAssignments: number };
};

type SubProcess = {
  id: string;
  name: string;
  description: string | null;
  controls: ControlSummary[];
};

type Sample = {
  id: string;
  status: string;
  conclusion: string | null;
};

type FindingWithActions = {
  id: string;
  description: string;
  severity: string;
  _count: { actions: number };
};

type Assessment = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date | null;
  status: string;
  loa: string;
  activityType: { name: string };
  assessor: { name: string };
  samples: Sample[];
  findings: FindingWithActions[];
};

type OverviewStats = {
  totalControls: number;
  totalAssessments: number;
  plannedAssessments: number;
  completedAssessments: number;
  totalSamples: number;
  testedSamples: number;
  failedSamples: number;
  totalFindings: number;
  totalActions: number;
  effectiveCount: number;
  notEffectiveCount: number;
  notAssessedCount: number;
};

type Props = {
  processArea: ProcessArea;
  subProcesses: SubProcess[];
  assessments: Assessment[];
  controlsByAssessment: Map<string, { controlId: string; effective: string | null }[]>;
  overviewStats: OverviewStats;
  allControls: ControlSummary[];
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const tabStyles = (active: boolean) =>
  active
    ? "px-6 py-3 text-sm font-semibold text-slate-900 border-b-2 border-slate-900 bg-white"
    : "px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 border-b-2 border-transparent hover:border-slate-300";

const statusBadge: Record<string, string> = {
  Planned: "bg-slate-100 text-slate-700",
  InProgress: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

const severityBadge: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  Serious: "bg-red-100 text-red-700",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProcessDetailsClient({
  processArea,
  subProcesses,
  assessments,
  controlsByAssessment,
  overviewStats,
  allControls,
}: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "subprocesses" | "assessments">("overview");
  const router = useRouter();

  // ── Tab 3: New Assessment modal state ──
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [newAssessmentName, setNewAssessmentName] = useState("");
  const [newAssessmentStart, setNewAssessmentStart] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedControls, setSelectedControls] = useState<Set<string>>(
    new Set(allControls.map((c) => c.id))
  );
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentSaving, setAssessmentSaving] = useState(false);

  // ── Tab 2: Control edit modal state ──
  const [editingControl, setEditingControl] = useState<ControlSummary | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [linkedSubProcessIds, setLinkedSubProcessIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Tab 2: Add Control modal state ──
  const [addControlSubProcessId, setAddControlSubProcessId] = useState<string | null>(null);
  const [addControlName, setAddControlName] = useState("");
  const [addControlStatement, setAddControlStatement] = useState("");
  const [addControlType, setAddControlType] = useState("Procedural");
  const [addControlError, setAddControlError] = useState<string | null>(null);
  const [addControlSaving, setAddControlSaving] = useState(false);

  // ── Tab 2: Delete Control confirmation state ──
  const [deleteControlTarget, setDeleteControlTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteControlError, setDeleteControlError] = useState<string | null>(null);
  const [deleteControlSaving, setDeleteControlSaving] = useState(false);

  // ── Tab 2: Add SubProcess modal state ──
  const [showAddSubProcess, setShowAddSubProcess] = useState(false);

  const openEditControl = async (control: ControlSummary) => {
    setEditingControl(control);
    setEditForm({
      name: control.name,
      statement: control.statement,
      controlType: control.controlType,
      isHsseCritical: control.isHsseCritical ? "true" : "false",
      ramRating: control.ramRating || "",
      riskWeight: String(control.riskWeight),
      rawHealthScore: String(control.rawHealthScore),
    });
    setSaveError(null);

    // Fetch existing ControlSubProcess junction links for this control,
    // then merge with the primary subProcessId (always linked).
    try {
      const res = await fetch(`/api/admin/table/ControlSubProcess/data?controlId=${control.id}`);
      if (res.ok) {
        const data = await res.json();
        const linkedIds = (data.rows || [])
          .filter((row: any) => row.controlId === control.id)
          .map((row: any) => row.subProcessId);
        // Always include the primary sub-process
        const withPrimary = new Set<string>(linkedIds);
        withPrimary.add(control.subProcessId);
        setLinkedSubProcessIds(withPrimary);
      }
    } catch {
      setLinkedSubProcessIds(new Set([control.subProcessId]));
    }
  };

  const handleSaveControl = async () => {
    if (!editingControl) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/admin/table/Control/${editingControl.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          statement: editForm.statement,
          controlType: editForm.controlType,
          isHsseCritical: editForm.isHsseCritical === "true",
          ramRating: editForm.ramRating || null,
          riskWeight: parseInt(editForm.riskWeight) || 1,
          rawHealthScore: parseInt(editForm.rawHealthScore) || 80,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save control");
      }

      // Sync ControlSubProcess junction links — diff existing vs selected,
      // delete removed links, create new ones.
      const linksRes = await fetch(`/api/admin/table/ControlSubProcess/data?controlId=${editingControl.id}`);
      let existingLinks: { id: string; subProcessId: string }[] = [];
      if (linksRes.ok) {
        const linksData = await linksRes.json();
        existingLinks = (linksData.rows || []).filter(
          (r: any) => r.controlId === editingControl.id
        );
      }

      const existingBySubProcess = new Map(existingLinks.map((l) => [l.subProcessId, l.id]));
      // Never delete the primary sub-process link
      const toDelete = existingLinks.filter(
        (l) => l.subProcessId !== editingControl.subProcessId && !linkedSubProcessIds.has(l.subProcessId)
      );
      const toCreate = Array.from(linkedSubProcessIds)
        .filter((spId) => spId !== editingControl.subProcessId) // primary is always linked
        .filter((spId) => !existingBySubProcess.has(spId));

      // Delete removed links (excluding primary)
      for (const link of toDelete) {
        await fetch(`/api/admin/table/ControlSubProcess/${link.id}`, {
          method: "DELETE",
        }).catch(() => {});
      }
      // Create new links
      for (const spId of toCreate) {
        await fetch("/api/admin/table/ControlSubProcess/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlId: editingControl.id, subProcessId: spId }),
        }).catch(() => {});
      }

      setEditingControl(null);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save control");
    } finally {
      setSaving(false);
    }
  };

  const handleAddControl = async () => {
    if (!addControlSubProcessId) return;
    if (!addControlName.trim()) {
      setAddControlError("Control name is required");
      return;
    }
    if (!addControlStatement.trim()) {
      setAddControlError("Control statement is required");
      return;
    }

    setAddControlSaving(true);
    setAddControlError(null);

    try {
      const res = await fetch("/api/admin/table/Control/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addControlName.trim(),
          statement: addControlStatement.trim(),
          controlType: addControlType,
          processAreaId: processArea.id,
          subProcessId: addControlSubProcessId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create control");
      }

      setAddControlSubProcessId(null);
      setAddControlName("");
      setAddControlStatement("");
      setAddControlType("Procedural");
      router.refresh();
    } catch (err) {
      setAddControlError(err instanceof Error ? err.message : "Failed to create control");
    } finally {
      setAddControlSaving(false);
    }
  };

  const handleDeleteControl = async () => {
    if (!deleteControlTarget) return;

    setDeleteControlSaving(true);
    setDeleteControlError(null);

    try {
      const res = await fetch(`/api/admin/table/Control/${deleteControlTarget.id}?cascade=true`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete control");
      }

      setDeleteControlTarget(null);
      router.refresh();
    } catch (err) {
      setDeleteControlError(err instanceof Error ? err.message : "Failed to delete control");
    } finally {
      setDeleteControlSaving(false);
    }
  };

  const handleCreateAssessment = async () => {
    if (!newAssessmentName.trim()) {
      setAssessmentError("Assessment name is required");
      return;
    }
    if (selectedControls.size === 0) {
      setAssessmentError("At least one control must be selected");
      return;
    }

    setAssessmentSaving(true);
    setAssessmentError(null);

    try {
      // Get first activity type
      const actRes = await fetch("/api/admin/table/AssuranceActivityType/data");
      const actData = await actRes.json();
      const activityTypeId = actData.rows?.[0]?.id;
      if (!activityTypeId) {
        throw new Error("No activity types found. Create one first.");
      }

      // Create the assessment via admin API (uses session user as assessor,
      // activity type's defaultLOA for LOA, and defaults status to Planned)
      const createRes = await fetch("/api/admin/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAssessmentName.trim(),
          activityTypeId,
          startDate: newAssessmentStart,
          controlIds: Array.from(selectedControls),
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to create assessment");
      }

      const assessment = await createRes.json();
      setShowNewAssessment(false);
      router.push(`/fla/${assessment.id}`);
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setAssessmentSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Breadcrumb */}
      <Link href="/setup/process-areas" className="text-sm text-slate-500 hover:underline">
        ← Process Areas
      </Link>

      {/* Header */}
      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{processArea.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {processArea.pId && <span className="font-mono mr-2">{processArea.pId}</span>}
            {processArea.description}
            {processArea.standard && (
              <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {processArea.standard}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 border-b border-slate-200 flex">
        <button onClick={() => setActiveTab("overview")} className={tabStyles(activeTab === "overview")}>
          Process Overview
        </button>
        <button onClick={() => setActiveTab("subprocesses")} className={tabStyles(activeTab === "subprocesses")}>
          Sub-process & Controls
        </button>
        <button onClick={() => setActiveTab("assessments")} className={tabStyles(activeTab === "assessments")}>
          Assessments
        </button>
      </div>

      {/* ─── TAB 1: Process Overview ───────────────────────────────────── */}

      {activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Effective Controls" value={`${overviewStats.effectiveControls}/${overviewStats.totalControls}`} color="blue" />
            <StatCard label="Assessments Completed" value={`${overviewStats.completedAssessments}/${overviewStats.totalAssessments}`} color="indigo" />
            <StatCard label="Total Findings" value={overviewStats.totalFindings} color="orange" />
            <StatCard label="Open Actions" value={`${overviewStats.completedActions}/${overviewStats.totalActions}`} color="red" />
          </div>

          {/* Process Health */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">📊 Process Health</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-3">Control Effectiveness</h3>
                <div className="space-y-3">
                  <HealthBar
                    label="Effective"
                    value={overviewStats.effectiveCount}
                    total={overviewStats.effectiveCount + overviewStats.notEffectiveCount + overviewStats.notAssessedCount}
                    color="green"
                  />
                  <HealthBar
                    label="Not Effective"
                    value={overviewStats.notEffectiveCount + overviewStats.neverTestedCount}
                    total={overviewStats.totalControls}
                    color="red"
                  />
                  <HealthBar
                    label="Never Assessed"
                    value={overviewStats.neverTestedCount}
                    total={overviewStats.totalControls}
                    color="slate"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-3">Assessment Activity</h3>
                <div className="space-y-3">
                  <HealthBar
                    label="Completed"
                    value={overviewStats.completedAssessments}
                    total={overviewStats.totalAssessments || 1}
                    color="green"
                  />
                  <HealthBar
                    label="Not Completed"
                    value={overviewStats.totalAssessments - overviewStats.completedAssessments}
                    total={overviewStats.totalAssessments || 1}
                    color="slate"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-3">Sample Testing</h3>
                <div className="space-y-3">
                  <HealthBar
                    label={`Effective (${overviewStats.effectiveSamples}/${overviewStats.testedSamples || 0})`}
                    value={overviewStats.effectiveSamples}
                    total={overviewStats.testedSamples || 1}
                    color="green"
                  />
                  <HealthBar
                    label="Not Effective"
                    value={(overviewStats.testedSamples || 0) - overviewStats.effectiveSamples}
                    total={overviewStats.testedSamples || 1}
                    color="red"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Outstanding Actions */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">⚠️ Outstanding Actions from Findings</h2>
            {assessments
              .filter((a) => a.findings.length > 0)
              .flatMap((a) =>
                a.findings
                  .filter((f) => f._count.actions > 0)
                  .map((f) => ({ assessmentName: a.name, assessmentId: a.id, finding: f }))
              ).length > 0 ? (
              <div className="space-y-3">
                {assessments
                  .filter((a) => a.findings.length > 0)
                  .flatMap((a) =>
                    a.findings
                      .filter((f) => f._count.actions > 0)
                      .map((f) => ({ assessmentName: a.name, assessmentId: a.id, finding: f }))
                  )
                  .slice(0, 10)
                  .map((item) => (
                    <div key={item.finding.id} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${severityBadge[item.finding.severity]}`}>
                          {item.finding.severity}
                        </span>
                        <span className="text-sm text-slate-700">{item.finding.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{item.assessmentName}</span>
                        <span className="text-xs text-slate-500">{item.finding._count.actions} action(s)</span>
                        <Link href={`/fla/${item.assessmentId}`} className="text-xs text-blue-600 hover:underline">
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No outstanding actions from findings.</p>
            )}
          </div>

          {/* Sub-Process Summary */}
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">📂 Sub-Processes</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subProcesses.map((sp) => (
                <div key={sp.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="font-medium text-sm text-slate-900">{sp.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{sp.controls.length} control(s)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Sub-process & Controls ─────────────────────────────── */}

      {activeTab === "subprocesses" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowAddSubProcess(true)}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + Add SubProcess
            </button>
          </div>
          {subProcesses.map((sp) => (
            <div key={sp.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900">{sp.name}</h2>
                {sp.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{sp.description}</p>
                )}
              </div>

              {sp.controls.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Control</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Type</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Health</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Risk</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Last Tested</th>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Result</th>
                        <th className="px-4 py-2 text-center font-medium text-slate-600">
                          <button
                            type="button"
                            onClick={() => {
                              setAddControlSubProcessId(sp.id);
                              setAddControlName("");
                              setAddControlStatement("");
                              setAddControlType("Procedural");
                              setAddControlError(null);
                            }}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            +Add Control
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sp.controls.map((c) => (
                        <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <button
                              onClick={() => openEditControl(c)}
                              className="font-medium text-slate-900 hover:text-blue-600 hover:underline text-left"
                            >
                              {c.name}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-slate-600">{c.controlType}</td>
                          <td className="px-4 py-2">
                            {c._count.controlAssignments === 0 ? (
                              <HealthBadge score={0} />
                            ) : (
                              <HealthBadge score={c.rawHealthScore} />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs font-medium ${c.isHsseCritical ? "text-red-600" : "text-slate-600"}`}>
                              {c.isHsseCritical ? "HSSE Critical" : c.ramRating || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-600">
                            {c._count.controlAssignments === 0 ? (
                              <span className="text-slate-400 italic">Never Tested</span>
                            ) : c.lastTestedDate ? (
                              new Date(c.lastTestedDate).toLocaleDateString()
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {c._count.controlAssignments === 0 ? (
                              <span className="text-xs text-slate-400 italic">—</span>
                            ) : (
                              <span className={`text-xs font-medium ${c.lastTestResult === "Pass" ? "text-green-600" : c.lastTestResult === "Fail" ? "text-red-600" : "text-slate-400"}`}>
                                {c.lastTestResult || "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditControl(c)}
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                Edit
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                onClick={() => setDeleteControlTarget({ id: c.id, name: c.name })}
                                className="text-xs text-red-600 hover:underline font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  No controls in this sub-process yet.
                  <button
                    type="button"
                    onClick={() => {
                      setAddControlSubProcessId(sp.id);
                      setAddControlName("");
                      setAddControlStatement("");
                      setAddControlType("Procedural");
                      setAddControlError(null);
                    }}
                    className="ml-1 text-blue-600 hover:underline"
                  >
                    +Add Control
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 3: Assessments ──────────────────────────────────────────── */}

      {activeTab === "assessments" && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {assessments.length} assessment(s) with controls from this process area
            </p>
            <button
              onClick={() => {
                setSelectedControls(new Set(allControls.map((c) => c.id)));
                setNewAssessmentName("");
                setNewAssessmentStart(new Date().toISOString().slice(0, 10));
                setAssessmentError(null);
                setShowNewAssessment(true);
              }}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + Add Assessment
            </button>
          </div>

          {assessments.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Activity Type</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Assessor</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Start Date</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Findings</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Actions</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => {
                    const controls = controlsByAssessment.get(a.id) || [];
                    return (
                      <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link href={`/fla/${a.id}`} className="font-medium text-blue-600 hover:underline">
                            {a.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{a.activityType.name}</td>
                        <td className="px-4 py-2 text-slate-600">{a.assessor.name}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge[a.status] || "bg-slate-100 text-slate-700"}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{new Date(a.startDate).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-slate-600">{a.findings.length}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {a.findings.reduce((s, f) => s + f._count.actions, 0)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{controls.length} control(s)</span>
                            <Link href={`/fla/${a.id}`} className="text-xs text-blue-600 hover:underline">
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No assessments yet. Click &quot;+ Add Assessment&quot; to create one with all controls pre-selected.
            </div>
          )}
        </div>
      )}

      {/* ─── CONTROL EDIT MODAL ────────────────────────────────────────── */}

      {editingControl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit Control</h3>

            {saveError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Name">
                <input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Statement">
                <textarea
                  value={editForm.statement || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, statement: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Control Type">
                  <select
                    value={editForm.controlType || "Procedural"}
                    onChange={(e) => setEditForm((f) => ({ ...f, controlType: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Administrative">Administrative</option>
                    <option value="Procedural">Procedural</option>
                    <option value="Analytical">Analytical</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Informational">Informational</option>
                    <option value="Engineering">Engineering</option>
                  </select>
                </Field>
                <Field label="Risk Weight">
                  <input
                    type="number"
                    value={editForm.riskWeight || "1"}
                    onChange={(e) => setEditForm((f) => ({ ...f, riskWeight: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="RAM Rating">
                  <input
                    value={editForm.ramRating || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, ramRating: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Health Score">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.rawHealthScore || "80"}
                    onChange={(e) => setEditForm((f) => ({ ...f, rawHealthScore: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="HSSE Critical">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.isHsseCritical === "true"}
                    onChange={(e) => setEditForm((f) => ({ ...f, isHsseCritical: e.target.checked ? "true" : "false" }))}
                    className="rounded"
                  />
                  Yes
                </label>
              </Field>

              <Field label="Linked Sub-Processes">
                <p className="text-xs text-slate-500 mb-2">
                  Also link this control to additional sub-processes (e.g. across different standards).
                  The primary sub-process is set when the control is created.
                </p>
                <div className="max-h-40 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
                  {subProcesses.map((sp) => {
                    const isPrimary = editingControl?.subProcessId === sp.id;
                    return (
                      <label
                        key={sp.id}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm ${isPrimary ? 'bg-blue-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={linkedSubProcessIds.has(sp.id)}
                          disabled={isPrimary}
                          onChange={() => {
                            if (isPrimary) return;
                            const next = new Set(linkedSubProcessIds);
                            if (next.has(sp.id)) next.delete(sp.id);
                            else next.add(sp.id);
                            setLinkedSubProcessIds(next);
                          }}
                          className="rounded"
                        />
                        <span className={`text-slate-700 ${isPrimary ? 'font-medium' : ''}`}>{sp.name}</span>
                        {isPrimary ? (
                          <span className="text-xs text-blue-600 ml-auto font-medium">Primary</span>
                        ) : linkedSubProcessIds.has(sp.id) ? (
                          <span className="text-xs text-slate-400 ml-auto">linked</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingControl(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveControl}
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── NEW ASSESSMENT MODAL ───────────────────────────────────────── */}

      {showNewAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">New Assessment</h3>

            {assessmentError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {assessmentError}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Assessment Name">
                <input
                  value={newAssessmentName}
                  onChange={(e) => setNewAssessmentName(e.target.value)}
                  placeholder="e.g. Gasification FLA — Q3"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Start Date">
                <input
                  type="date"
                  value={newAssessmentStart}
                  onChange={(e) => setNewAssessmentStart(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              {/* Control Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Controls ({selectedControls.size} / {allControls.length} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedControls(new Set(allControls.map((c) => c.id)))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedControls(new Set())}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
                  {allControls.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedControls.has(c.id)}
                        onChange={() => {
                          const next = new Set(selectedControls);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          setSelectedControls(next);
                        }}
                        className="rounded"
                      />
                      <span className="text-slate-700">{c.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{c.controlType}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowNewAssessment(false)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAssessment}
                disabled={assessmentSaving}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {assessmentSaving ? "Creating..." : "Create Assessment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD CONTROL MODAL ─────────────────────────────────────────── */}

      {addControlSubProcessId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Control</h3>

            {addControlError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addControlError}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Control Name">
                <input
                  value={addControlName}
                  onChange={(e) => setAddControlName(e.target.value)}
                  placeholder="e.g. Conduct Air Dispersion Modelling"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Statement">
                <textarea
                  value={addControlStatement}
                  onChange={(e) => setAddControlStatement(e.target.value)}
                  rows={3}
                  placeholder="Describe the control statement"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Control Type">
                <select
                  value={addControlType}
                  onChange={(e) => setAddControlType(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="Administrative">Administrative</option>
                  <option value="Procedural">Procedural</option>
                  <option value="Analytical">Analytical</option>
                  <option value="Behavioral">Behavioral</option>
                  <option value="Informational">Informational</option>
                  <option value="Engineering">Engineering</option>
                </select>
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setAddControlSubProcessId(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddControl}
                disabled={addControlSaving}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {addControlSaving ? "Adding..." : "Add Control"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD SUBPROCESS FORM ──────────────────────────────────────── */}

      {showAddSubProcess && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddSubProcess(false);
          }}
        >
          <form
            onSubmit={async (e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await fetch("/api/admin/table/SubProcess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: fd.get("name")?.toString() ?? "",
                  description: fd.get("description")?.toString() || null,
                  processAreaId: fd.get("processAreaId")?.toString() ?? "",
                }),
              });
              setShowAddSubProcess(false);
              router.refresh();
            }}
            className="my-8 w-full max-w-md space-y-3 rounded border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-900">
                Add Sub-Process to {processArea.name}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddSubProcess(false)}
                className="text-xl leading-none text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <input type="hidden" name="processAreaId" value={processArea.id} />

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <input
                name="name"
                required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                name="description"
                rows={2}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddSubProcess(false)}
                className="text-sm text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── DELETE CONTROL CONFIRMATION ───────────────────────────────── */}

      {deleteControlTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Control</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <strong>&quot;{deleteControlTarget.name}&quot;</strong>?
              This action cannot be undone. Any assignments, samples, or findings linked to this control
              may also be affected.
            </p>

            {deleteControlError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteControlError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteControlTarget(null)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteControl}
                disabled={deleteControlSaving}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteControlSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "blue" | "indigo" | "orange" | "red" | "green" | "slate";
}) {
  const colorStyles: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    red: "border-red-200 bg-red-50 text-red-900",
    green: "border-green-200 bg-green-50 text-green-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorStyles[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: "green" | "red" | "slate" | "blue";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const barColors: Record<string, string> = {
    green: "bg-green-500",
    red: "bg-red-500",
    slate: "bg-slate-400",
    blue: "bg-blue-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500 font-medium">{value} ({pct}%)</span>
      </div>
      <div className="mt-1 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-600 bg-green-50" :
    score >= 60 ? "text-yellow-600 bg-yellow-50" :
    "text-red-600 bg-red-50";

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>
      {score}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
