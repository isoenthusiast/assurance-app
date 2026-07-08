import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { deleteBadge } from "./actions";
import BadgesClient from "./BadgesClient";

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [badges, editing, processAreas] = await Promise.all([
    prisma.achievementBadge.findMany({
      orderBy: { badgeName: "asc" },
      include: { processArea: { select: { name: true, standard: true } } },
    }),
    edit ? prisma.achievementBadge.findUnique({ where: { id: edit } }) : Promise.resolve(null),
    prisma.processArea.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Badge Setup</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage achievement badges — define criteria, emotional drives, rarity, and badge images for gamification.
      </p>

      <BadgesClient
        key={editing?.id ?? "new"}
        badges={badges}
        editing={editing}
        deleteAction={deleteBadge}
        processAreas={processAreas}
      />
    </div>
  );
}
