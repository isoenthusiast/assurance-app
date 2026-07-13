import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Applying schema changes...");

  // Add columns to ActivityLog
  await prisma.$executeRawUnsafe(`ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "refTable" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "refRecord" TEXT`);
  console.log("✅ Added refTable, refRecord to ActivityLog");

  // Create ActivityLogType table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ActivityLogType" (
      "id" TEXT PRIMARY KEY,
      "activityType" TEXT NOT NULL,
      "refTable" TEXT,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Created ActivityLogType table");

  // Create unique index
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ActivityLogType_activityType_key" ON "ActivityLogType"("activityType")`);
  console.log("✅ Created unique index on activityType");

  // Drop subProcessId column and FK from Control (migrated to junction table)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Control" DROP CONSTRAINT IF EXISTS "Control_subProcessId_fkey"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Control" DROP COLUMN IF EXISTS "subProcessId"`);
  console.log("✅ Dropped subProcessId column from Control");

  // Create MRequirement table (SMDS ICOP Statutory Requirements)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MRequirement" (
      "rID" INTEGER PRIMARY KEY,
      "standard" TEXT NOT NULL,
      "pID" TEXT NOT NULL,
      "requirementId" TEXT NOT NULL,
      "clauseContent" TEXT NOT NULL,
      "intentOutcome" TEXT NOT NULL,
      "clauseApplicability" TEXT NOT NULL,
      "references" TEXT,
      "applicable" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Created MRequirement table");

  await prisma.$disconnect();
  console.log("Schema sync complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
