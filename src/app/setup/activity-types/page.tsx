import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { deleteActivityType } from "./actions";
import ActivityTypesClient from "./ActivityTypesClient";

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

      {/* Keyed on the editing target so the add/edit form modal fully
          remounts (and re-derives its open/closed state) whenever the user
          switches between "Add" and "Edit <type>", or between editing two
          different activity types. */}
      <ActivityTypesClient
        key={editing?.id ?? "new"}
        types={types}
        editing={editing}
        loaOptions={loaOptions}
        deleteAction={deleteActivityType}
      />
    </div>
  );
}
