import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { saveActivityType, deleteActivityType } from "./actions";
import ActivityTypesTable from "./ActivityTypesTable";

const loaOptions = [
  { value: "FirstLine", label: "1st Line" },
  { value: "SecondLine", label: "2nd Line" },
  { value: "ThirdLine", label: "3rd Line" },
];

export default async function ActivityTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [types, editing] = await Promise.all([
    prisma.assuranceActivityType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assessments: true } } },
    }),
    edit ? prisma.assuranceActivityType.findUnique({ where: { id: edit } }) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Assurance Activity Types</h1>
      <p className="mt-1 text-sm text-slate-500">
        The kinds of assurance activity that can be planned — e.g. FLA, 2nd Line Audit, Health Check.
      </p>

      <ActivityTypesTable types={types} editing={editing} loaOptions={loaOptions} deleteAction={deleteActivityType} />

      <form
        action={saveActivityType}
        className="mt-8 max-w-md space-y-3 rounded border border-slate-200 bg-white p-5"
      >
        <h2 className="font-medium text-slate-900">
          {editing ? "Edit Activity Type" : "Add Activity Type"}
        </h2>
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            name="name"
            defaultValue={editing?.name ?? ""}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Default LOA</label>
          <select
            name="defaultLOA"
            defaultValue={editing?.defaultLOA ?? "FirstLine"}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {loaOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            defaultValue={editing?.description ?? ""}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editing ? "Save changes" : "Add"}
          </button>
          {editing && (
            <Link href="/setup/activity-types" className="text-sm text-slate-500 hover:underline">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
