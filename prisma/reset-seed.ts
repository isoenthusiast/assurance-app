import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { loadControls, controlData } from "./controls-data";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

/**
 * FULL RESET + RESEED
 *   1. Deletes every record from every table (FK-safe order).
 *   2. Recreates the admin user (prints a fresh password).
 *   3. Seeds ProcessArea / SubProcess / Control from Combined_Controls.csv,
 *      including all imported CSV columns.
 *
 * Run after applying the schema:  npx prisma db push  &&  npm run db:reset-seed
 */

async function clearAll() {
  console.log("🧹 Clearing all records...");
  // Children first to respect foreign keys.
  await prisma.sample.deleteMany();
  await prisma.pointTransaction.deleteMany();
  await prisma.userAchievement.deleteMany();
  await prisma.behaviorMeasurement.deleteMany();
  await prisma.emotionalDriveMetric.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.control.deleteMany();
  await prisma.subProcess.deleteMany();
  await prisma.processArea.deleteMany();
  await prisma.achievementBadge.deleteMany();
  await prisma.assuranceActivityType.deleteMany();
  await prisma.user.deleteMany();
  console.log("   ✓ Database cleared.\n");
}

async function createAdmin() {
  const password = crypto.randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name: "Admin", username: "admin", passwordHash, role: "Admin" },
  });
  console.log("👤 Recreated admin user.");
  console.log("   username: admin");
  console.log(`   password: ${password}`);
  console.log("   Save this password now — it will not be shown again.\n");
}

async function seedControls() {
  const controls = loadControls();
  console.log(`✓ Parsed ${controls.length} control statements\n`);

  const byProcessArea = new Map<string, typeof controls>();
  for (const c of controls) {
    const key = c.processArea || "Uncategorised";
    if (!byProcessArea.has(key)) byProcessArea.set(key, []);
    byProcessArea.get(key)!.push(c);
  }

  let processAreas = 0;
  let subProcesses = 0;
  let controlsCreated = 0;

  for (const [processAreaName, areaControls] of byProcessArea.entries()) {
    const processArea = await prisma.processArea.create({
      data: { name: processAreaName, description: `${processAreaName} process area` },
    });
    processAreas++;

    const bySubProcess = new Map<string, typeof areaControls>();
    for (const c of areaControls) {
      const key = c.subProcess || processAreaName;
      if (!bySubProcess.has(key)) bySubProcess.set(key, []);
      bySubProcess.get(key)!.push(c);
    }

    for (const [subProcessName, subControls] of bySubProcess.entries()) {
      const subProcess = await prisma.subProcess.create({
        data: {
          name: subProcessName,
          description: `${subProcessName} sub-process`,
          processAreaId: processArea.id,
        },
      });
      subProcesses++;

      for (const c of subControls) {
        await prisma.control.create({
          data: {
            ...controlData(c),
            processAreaId: processArea.id,
            subProcessId: subProcess.id,
          },
        });
        controlsCreated++;
      }
    }
    console.log(`📋 ${processAreaName}: ${areaControls.length} controls`);
  }

  console.log("\n✅ Reseed complete.");
  console.log(`  • Process Areas: ${processAreas}`);
  console.log(`  • Sub-Processes: ${subProcesses}`);
  console.log(`  • Controls:      ${controlsCreated}`);
}

async function main() {
  console.log("🔄 SEAM Assurance — full reset & reseed\n");
  await clearAll();
  await createAdmin();
  await seedControls();
}

main()
  .catch((e) => {
    console.error("❌ Reset/reseed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
