import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: "postgresql://postgres:esswkUtSQvtRdWDhBFaPEMflNNwyZgnO@hayabusa.proxy.rlwy.net:12076/railway",
});
const prisma = new PrismaClient({ adapter });

async function verify() {
  const users = await prisma.user.count();
  const assessments = await prisma.assessment.count();
  const controls = await prisma.control.count();
  const processAreas = await prisma.processArea.count();
  const subProcesses = await prisma.subProcess.count();
  const findings = await prisma.finding.count();
  const actions = await prisma.action.count();
  const samples = await prisma.sample.count();
  const controlAssignments = await prisma.controlAssignment.count();

  console.log("\nRailway PostgreSQL counts:");
  console.log(`  Users:              ${users}`);
  console.log(`  Process Areas:       ${processAreas}`);
  console.log(`  SubProcesses:        ${subProcesses}`);
  console.log(`  Controls:            ${controls}`);
  console.log(`  Assessments:         ${assessments}`);
  console.log(`  Control Assignments: ${controlAssignments}`);
  console.log(`  Samples:             ${samples}`);
  console.log(`  Findings:            ${findings}`);
  console.log(`  Actions:             ${actions}`);

  await prisma.$disconnect();
}

verify().catch(console.error);
