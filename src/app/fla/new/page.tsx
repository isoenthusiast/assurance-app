import { prisma } from "@/lib/prisma";
import { createAssessment } from "../actions";
import Link from "next/link";

const loaOptions = [
  { value: "FirstLine", label: "1st Line" },
  { value: "SecondLine", label: "2nd Line" },
  { value: "ThirdLine", label: "3rd Line" },
];

export default async function NewAssessmentPage() {
  const [activityTypes, users] = await Promise.all([
    prisma.assuranceActivityType.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (activityTypes.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-8">
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create at least one Assurance Activity Type before planning an assessment.{" "}
          <Link href="/setup/activity-types" className="underline">
            Go to Activity Types
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Plan Assessment</h1>

      <form action={createAssessment} className="mt-6 space-y-3 rounded border border-slate-200 bg-white p-5">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            name="name"
            required
            placeholder="e.g. Gasification FLA — Week 25"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Activity Type</label>
          <select
            name="activityTypeId"
            defaultValue={activityTypes[0]?.id}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Assessor</label>
          <select
            name="assessorId"
            defaultValue={users[0]?.id}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Start Date</label>
            <input
              name="startDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">End Date</label>
            <input
              name="endDate"
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Line of Assurance</label>
          <select name="loa" defaultValue="FirstLine" className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
            {loaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Create
          </button>
          <Link href="/fla" className="text-sm text-slate-500 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
