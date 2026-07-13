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

  // Rename MRequirement → Requirement (if old table exists)
  const oldTable = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'MRequirement')`
  );
  if (oldTable[0]?.exists) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MRequirement" RENAME TO "Requirement"`);
    console.log("✅ Renamed MRequirement → Requirement");
  }

  // Create Requirement table (SMDS ICOP Statutory Requirements)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Requirement" (
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
  console.log("✅ Created Requirement table");

  // Add processAreaId column (backfilled from ProcessArea via pID mapping)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "processAreaId" TEXT`);
  // Backfill: match Requirement.pID → ProcessArea.pId
  const backfillResult = await prisma.$executeRawUnsafe(`
    UPDATE "Requirement" r
    SET "processAreaId" = pa.id
    FROM "ProcessArea" pa
    WHERE r."pID" = pa."pId" AND r."processAreaId" IS NULL
  `);
  console.log(`✅ Added processAreaId column, backfilled ${backfillResult} rows`);

  // Create MapControl2Requirement junction table (M2M: Control ⟷ Requirement)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MapControl2Requirement" (
      "id" TEXT PRIMARY KEY,
      "controlId" TEXT NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
      "requirementRId" INTEGER NOT NULL REFERENCES "Requirement"("rID") ON DELETE CASCADE,
      "processAreaId" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("controlId", "requirementRId")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MapControl2Requirement_controlId_idx" ON "MapControl2Requirement"("controlId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MapControl2Requirement_requirementRId_idx" ON "MapControl2Requirement"("requirementRId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MapControl2Requirement_processAreaId_idx" ON "MapControl2Requirement"("processAreaId")`);
  console.log("✅ Created MapControl2Requirement table");

  // Backfill MapControl2Requirement: link Controls to Requirements via shared ProcessArea
  const mapBackfill = await prisma.$executeRawUnsafe(`
    INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId")
    SELECT DISTINCT
      gen_random_uuid()::text,
      c.id,
      r."rID",
      pa.id
    FROM "Control" c
    JOIN "ProcessArea" pa ON c."processAreaId" = pa.id
    JOIN "Requirement" r ON r."processAreaId" = pa.id
    WHERE NOT EXISTS (
      SELECT 1 FROM "MapControl2Requirement" m
      WHERE m."controlId" = c.id AND m."requirementRId" = r."rID"
    )
  `);
  console.log(`✅ Backfilled MapControl2Requirement: ${mapBackfill} mappings`);

  await prisma.$disconnect();
  console.log("Schema sync complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
