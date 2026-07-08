import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const LEVELS = ["Bronze", "Silver", "Gold", "Platinum", "Black"] as const;

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  Bronze: "Starting level — after initiation of process activation",
  Silver: "Having performed certain missions to justify XP in the process attribute",
  Gold: "Demonstrated mastery with consistent process delivery and quality",
  Platinum: "Elite performance with measurable impact across multiple assessments",
  Black: "Legendary — the highest tier of process excellence recognition",
};

const POINTS_PER_LEVEL: Record<string, number> = {
  Bronze: 100,
  Silver: 500,
  Gold: 1500,
  Platinum: 5000,
  Black: 15000,
};

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "Admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const processAreas = await prisma.processArea.findMany({
      orderBy: { name: "asc" },
    });

    let created = 0;
    let skipped = 0;

    for (const pa of processAreas) {
      for (const level of LEVELS) {
        const badgeName = pa.name;

        // Skip if badge with same name+level already exists
        const existing = await prisma.achievementBadge.findFirst({
          where: { badgeName, level },
        });

        if (existing) {
          skipped++;
          continue;
        }

        const description =
          `Badge of Process Excellence Recognition for ${pa.standard ? pa.standard + " - " : ""}${pa.name}.\n` +
          `${level} - ${LEVEL_DESCRIPTIONS[level]}`;

        await prisma.achievementBadge.create({
          data: {
            badgeName,
            description,
            icon: "🔍",
            emotionalDrive: "Achievement",
            rarity: level === "Black" ? "Legendary" : level === "Platinum" ? "Epic" : level === "Gold" ? "Rare" : "Uncommon",
            level,
            processAreaId: pa.id,
            pointsRequired: POINTS_PER_LEVEL[level],
            achievementType: "milestone_master",
          },
        });

        created++;
      }
    }

    return NextResponse.json({
      created,
      skipped,
      total: processAreas.length * LEVELS.length,
    });
  } catch (error) {
    console.error("Error generating process badges:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
