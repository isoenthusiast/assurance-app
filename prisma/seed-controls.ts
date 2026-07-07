import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadControls, controlData } from "./controls-data";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});

const prisma = new PrismaClient({ adapter });

/**
 * Incremental loader: upserts ProcessArea / SubProcess / Control from
 * Combined_Controls.csv WITHOUT deleting anything else. Existing controls
 * (matched by name within a process area) are updated in place.
 *
 * To wipe the database first, use `npm run db:reset-seed` instead.
 */
async function main() {
  console.log("🎮 Loading SEAM Controls into Database...\n");

  const controls = loadControls();
  console.log(`✓ Parsed ${controls.length} control statements\n`);

  const byProcessArea = new Map<string, typeof controls>();
  for (const c of controls) {
    const key = c.processArea || "Uncategorised";
    if (!byProcessArea.has(key)) byProcessArea.set(key, []);
    byProcessArea.get(key)!.push(c);
  }

  let processAreasCreated = 0;
  let subProcessesCreated = 0;
  let controlsCreated = 0;
  let controlsUpdated = 0;

  for (const [processAreaName, areaControls] of byProcessArea.entries()) {
    console.log(`📋 ${processAreaName} (${areaControls.length} controls)`);

    let processArea = await prisma.processArea.findUnique({
      where: { name: processAreaName },
    });
    if (!processArea) {
      processArea = await prisma.processArea.create({
        data: { name: processAreaName, description: `${processAreaName} process area` },
      });
      processAreasCreated++;
    }

    const bySubProcess = new Map<string, typeof areaControls>();
    for (const c of areaControls) {
      const key = c.subProcess || processAreaName;
      if (!bySubProcess.has(key)) bySubProcess.set(key, []);
      bySubProcess.get(key)!.push(c);
    }

    for (const [subProcessName, subControls] of bySubProcess.entries()) {
      let subProcess = await prisma.subProcess.findFirst({
        where: { name: subProcessName, processAreaId: processArea.id },
      });
      if (!subProcess) {
        subProcess = await prisma.subProcess.create({
          data: {
            name: subProcessName,
            description: `${subProcessName} sub-process`,
            processAreaId: processArea.id,
          },
        });
        subProcessesCreated++;
      }

      for (const c of subControls) {
        const data = {
          ...controlData(c),
          processAreaId: processArea.id,
          subProcessId: subProcess.id,
        };
        const existing = await prisma.control.findFirst({
          where: { name: c.controlName, processAreaId: processArea.id },
        });
        if (existing) {
          await prisma.control.update({ where: { id: existing.id }, data });
          controlsUpdated++;
        } else {
          await prisma.control.create({ data });
          controlsCreated++;
        }
      }
    }
  }

  console.log("\n✅ Controls loaded.");
  console.log(`  • Process Areas:  ${processAreasCreated} created`);
  console.log(`  • Sub-Processes:  ${subProcessesCreated} created`);
  console.log(`  • Controls:       ${controlsCreated} created, ${controlsUpdated} updated`);
  console.log(`\nTotal controls processed: ${controls.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding controls:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
