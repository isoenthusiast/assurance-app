/**
 * Clean SMDS template data — runs via the project's Prisma client.
 * Usage: npx tsx prisma/clean-smds.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get SMDS company
  const smds = await (prisma as any).$queryRawUnsafe(
    `SELECT id, "companyID" FROM "Company" WHERE "companyID" = 'SMDS' LIMIT 1`
  ) as any[];
  if (!smds.length) { console.log("SMDS not found"); return; }
  const smdsId = smds[0].id;
  console.log(`SMDS: ${smdsId}`);

  // Delete junction rows referencing SMDS controls
  const tables = [
    "ControlSubProcess",
    "ControlAssignment", 
    "MapControl2Requirement",
    "AssessmentTemplateControlLinkage",
  ];
  
  for (const t of tables) {
    let col = t === "AssessmentTemplateControlLinkage" ? "controlId" : "controlId";
    // Use both controlId and templateId for this table
    if (t === "AssessmentTemplateControlLinkage") {
      await (prisma as any).$queryRawUnsafe(
        `DELETE FROM "${t}" WHERE "templateId" IN (SELECT id FROM "AssessmentTemplate" WHERE "companyId" = $1)`,
        smdsId
      );
    }
    await (prisma as any).$queryRawUnsafe(
      `DELETE FROM "${t}" WHERE "controlId" IN (SELECT id FROM "Control" WHERE "companyId" = $1)`,
      smdsId
    );
    console.log(`  ${t}: done`);
  }

  // Delete AssessmentTemplateActivityType
  await (prisma as any).$queryRawUnsafe(
    `DELETE FROM "AssessmentTemplateActivityType" WHERE "templateId" IN (SELECT id FROM "AssessmentTemplate" WHERE "companyId" = $1)`,
    smdsId
  );
  console.log("  AssessmentTemplateActivityType: done");

  // Delete core tables
  for (const t of ["Control", "Requirement", "SubProcess", "ProcessArea", "Standard", "AssessmentTemplate"]) {
    await (prisma as any).$queryRawUnsafe(
      `DELETE FROM "${t}" WHERE "companyId" = $1`,
      smdsId
    );
    console.log(`  ${t}: done`);
  }

  // Verify
  const counts = await (prisma as any).$queryRawUnsafe(`
    SELECT 'Control' as t, COUNT(*) FROM "Control" WHERE "companyId" = $1
    UNION ALL SELECT 'Requirement', COUNT(*) FROM "Requirement" WHERE "companyId" = $1
    UNION ALL SELECT 'ProcessArea', COUNT(*) FROM "ProcessArea" WHERE "companyId" = $1
    UNION ALL SELECT 'Standard', COUNT(*) FROM "Standard" WHERE "companyId" = $1
  `, smdsId) as any[];
  
  console.log("\nAfter cleanup:");
  for (const r of counts) { console.log(`  ${r.t}: ${r.count}`); }

  await prisma.$disconnect();
  console.log("\n✅ Done. Ready to re-adopt templates.");
}

main().catch(e => { console.error(e); process.exit(1); });
