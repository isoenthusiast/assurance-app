import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});
const prisma = new PrismaClient({ adapter });

const ACTIVITY_TYPES = [
  { activityType: "Add Assessment Template", refTable: "AssessmentTemplate", description: "Create a new assessment template" },
  { activityType: "Update Assessment Template", refTable: "AssessmentTemplate", description: "Update an assessment template" },
  { activityType: "Delete Assessment Template", refTable: "AssessmentTemplate", description: "Delete an assessment template" },
  { activityType: "Plan Assessment", refTable: "Assessment", description: "Plan a new assessment" },
  { activityType: "Update Assessment", refTable: "Assessment", description: "Update an assessment" },
  { activityType: "Delete Assessment", refTable: "Assessment", description: "Delete an assessment" },
  { activityType: "Test Control", refTable: "ControlAssignment", description: "Test a control" },
  { activityType: "Add Sample", refTable: "Sample", description: "Add a sample record" },
  { activityType: "Update Sample", refTable: "Sample", description: "Update a sample record" },
  { activityType: "Delete Sample", refTable: "Sample", description: "Delete a sample record" },
  { activityType: "Record Finding", refTable: "Finding", description: "Record a finding" },
  { activityType: "Update Finding", refTable: "Finding", description: "Update a finding" },
  { activityType: "Delete Finding", refTable: "Finding", description: "Delete a finding" },
  { activityType: "Add Action", refTable: "Action", description: "Add a corrective action" },
  { activityType: "Update Action", refTable: "Action", description: "Update a corrective action" },
  { activityType: "Delete Action", refTable: "Action", description: "Delete a corrective action" },
  { activityType: "Create User", refTable: "User", description: "Create a new user" },
  { activityType: "Update User", refTable: "User", description: "Update a user" },
  { activityType: "Delete User", refTable: "User", description: "Delete a user" },
  { activityType: "Create Process Area", refTable: "ProcessArea", description: "Create a process area" },
  { activityType: "Update Process Area", refTable: "ProcessArea", description: "Update a process area" },
  { activityType: "Create SubProcess", refTable: "SubProcess", description: "Create a sub-process" },
  { activityType: "Update SubProcess", refTable: "SubProcess", description: "Update a sub-process" },
  { activityType: "Create Control", refTable: "Control", description: "Create a control" },
  { activityType: "Update Control", refTable: "Control", description: "Update a control" },
  { activityType: "Create Activity Type", refTable: "AssuranceActivityType", description: "Create an assurance activity type" },
  { activityType: "Import CSV", refTable: null, description: "Import data from CSV" },
  { activityType: "Execute SQL", refTable: null, description: "Execute custom SQL" },
  { activityType: "Sign In", refTable: null, description: "User signed in" },
  { activityType: "Sign Out", refTable: null, description: "User signed out" },
  { activityType: "Export Data", refTable: null, description: "Export table data" },
];

async function main() {
  let created = 0;
  for (const at of ACTIVITY_TYPES) {
    await prisma.activityLogType.upsert({
      where: { activityType: at.activityType },
      create: at,
      update: { refTable: at.refTable, description: at.description },
    });
    created++;
  }
  console.log(`✅ Seeded ${created} activity log types`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
