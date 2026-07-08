import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { BADGE_DEFINITIONS } from "../src/lib/gamification";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});

const prisma = new PrismaClient({ adapter });

// Emoji mapping for badges by drive
const driveEmojis: Record<string, string> = {
  Diversity: "🎨",
  Belonging: "👥",
  Recognition: "⭐",
  Achievement: "✅",
  Excellence: "💎",
  Growth: "📈",
  Contribution: "🤝",
  Security: "🛡️",
};

async function main() {
  console.log("🎮 Seeding gamification badges...\n");

  let created = 0;
  let skipped = 0;

  for (const badgeDef of BADGE_DEFINITIONS) {
    const existing = await prisma.achievementBadge.findFirst({
      where: { badgeName: badgeDef.badgeName, level: null },
    });

    if (existing) {
      console.log(`  ✓ Already exists: ${badgeDef.badgeName}`);
      skipped++;
      continue;
    }

    const emoji = driveEmojis[badgeDef.emotionalDrive] || "🏆";

    const badge = await prisma.achievementBadge.create({
      data: {
        badgeName: badgeDef.badgeName,
        description: badgeDef.description,
        emotionalDrive: badgeDef.emotionalDrive,
        rarity: badgeDef.rarity,
        pointsRequired: badgeDef.pointsRequired,
        controlsChecked: badgeDef.controlsChecked,
        streakDays: badgeDef.streakDays,
        achievementType: badgeDef.achievementType,
        icon: emoji,
      },
    });

    console.log(`  ✓ Created: ${emoji} ${badge.badgeName} (${badge.rarity})`);
    created++;
  }

  console.log(`\n✅ Gamification seed complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total badges: ${BADGE_DEFINITIONS.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
