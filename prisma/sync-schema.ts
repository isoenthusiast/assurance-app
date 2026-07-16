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

  // Add companyId column to Control
  await prisma.$executeRawUnsafe(`ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "companyId" TEXT`);
  console.log("✅ Added companyId column to Control");

  // Add companyId to scoped tables
  for (const t of ["ProcessArea", "SubProcess", "Requirement", "Assessment", "Attachment", "AssessmentTemplate", "UserRole"]) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "companyId" TEXT`);
  }
  console.log("✅ Added companyId column to ProcessArea, SubProcess, Requirement, Assessment, Attachment, AssessmentTemplate, UserRole");

  // Create UserCompany junction table (M2M: User ⟷ Company access control)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserCompany" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE("userId", "companyId")
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserCompany_userId_idx" ON "UserCompany"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UserCompany_companyId_idx" ON "UserCompany"("companyId")`);
  console.log("✅ Created UserCompany table");

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

  // NOTE: Backfill removed — the INSERT...SELECT Cartesian product was creating
  // 12,000+ unwanted mappings on every deploy (every control → every requirement in same PA).
  // Use scripts/map_controls_to_requirements.py for intelligent one-time mapping instead.
  // See /memories/master-data-protection.md for the full protection policy.

  // Create Standard table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Standard" (
      "id" TEXT PRIMARY KEY,
      "standard" TEXT NOT NULL,
      "standardDescription" TEXT,
      "sequenceNo" INTEGER NOT NULL DEFAULT 0,
      "companyId" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Add composite unique if table was just created (IF NOT EXISTS skips if already present)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Standard_standard_companyId_key" ON "Standard"("standard", "companyId")`);
  console.log("✅ Created Standard table");

  // Backfill Standard from ProcessArea.standard only (one-time migration).
  // WHERE NOT EXISTS prevents duplicates; no ON CONFLICT needed.
  // NOTE: ON CONFLICT removed because the unique constraint is composite (standard, companyId)
  // and backfilled rows have companyId=NULL. PostgreSQL treats NULLs as distinct in unique
  // constraints, so ON CONFLICT would never fire anyway.
  const stdBackfill = await prisma.$executeRawUnsafe(`
    INSERT INTO "Standard" ("id", "standard", "sequenceNo", "companyId")
    SELECT DISTINCT
      gen_random_uuid()::text,
      pa.standard,
      ROW_NUMBER() OVER (ORDER BY MIN(pa."createdAt")),
      NULL
    FROM "ProcessArea" pa
    WHERE pa.standard IS NOT NULL AND pa.standard != ''
      AND NOT EXISTS (SELECT 1 FROM "Standard" s WHERE s.standard = pa.standard AND s."companyId" IS NULL)
    GROUP BY pa.standard
  `);
  console.log(`✅ Backfilled Standard table: ${stdBackfill} standards`);

  // Add standardId to ProcessArea, backfill from Standard.standard match
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProcessArea" ADD COLUMN IF NOT EXISTS "StandardID" TEXT`);
  const paStdBackfill = await prisma.$executeRawUnsafe(`
    UPDATE "ProcessArea" pa
    SET "StandardID" = s.id
    FROM "Standard" s
    WHERE pa.standard = s.standard AND pa."StandardID" IS NULL
  `);
  console.log(`✅ Backfilled ProcessArea.StandardID: ${paStdBackfill} rows`);

  // Add composite unique constraints for multi-company dedup protection
  // Control: prevents duplicate control names within a company (defends against double Adopt Templates)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Control_name_companyId_key" ON "Control"("name", "companyId")`);
  console.log("✅ Added unique constraint: Control(name, companyId)");

  // Requirement: prevents duplicate requirements within a company
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Requirement_requirementId_standard_companyId_key" ON "Requirement"("requirementId", "standard", "companyId")`);
  console.log("✅ Added unique constraint: Requirement(requirementId, standard, companyId)");

  await prisma.$disconnect();
  console.log("Schema sync complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
