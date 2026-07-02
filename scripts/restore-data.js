/**
 * Restoration Script: Restore the 4 critical tables
 * Run: node scripts/restore-data.js
 */

const { PrismaClient } = require("../prisma/.prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function restoreData() {
  const dataDir = path.join(__dirname, "../data");

  try {
    console.log("🔄 Restoring critical data...\n");

    // Check if backup files exist
    const files = [
      "ProcessAreas.json",
      "SubProcesses.json",
      "Controls.json",
      "ActivityTypes.json",
    ];

    for (const file of files) {
      if (!fs.existsSync(path.join(dataDir, file))) {
        throw new Error(
          `❌ Backup file not found: ${file}\nRun export first: node scripts/export-data.js`
        );
      }
    }

    // Read backup files
    const processAreasData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "ProcessAreas.json"), "utf-8")
    );
    const subProcessesData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "SubProcesses.json"), "utf-8")
    );
    const controlsData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "Controls.json"), "utf-8")
    );
    const activityTypesData = JSON.parse(
      fs.readFileSync(path.join(dataDir, "ActivityTypes.json"), "utf-8")
    );

    // Restore ProcessAreas
    console.log("📁 Restoring Process Areas...");
    for (const pa of processAreasData) {
      await prisma.processArea.create({
        data: {
          id: pa.id,
          name: pa.name,
          description: pa.description || null,
          pId: pa.pId || null,
          standard: pa.standard || null,
          createdAt: new Date(pa.createdAt),
        },
      });
    }
    console.log(`   ✅ Restored ${processAreasData.length} Process Areas\n`);

    // Restore SubProcesses
    console.log("📂 Restoring Sub-Processes...");
    for (const sp of subProcessesData) {
      await prisma.subProcess.create({
        data: {
          id: sp.id,
          name: sp.name,
          description: sp.description || null,
          processAreaId: sp.processAreaId,
          createdAt: new Date(sp.createdAt),
        },
      });
    }
    console.log(`   ✅ Restored ${subProcessesData.length} Sub-Processes\n`);

    // Restore Controls
    console.log("✓ Restoring Controls...");
    for (const ctl of controlsData) {
      await prisma.control.create({
        data: {
          id: ctl.id,
          name: ctl.name,
          statement: ctl.statement,
          controlType: ctl.controlType,
          processAreaId: ctl.processAreaId,
          subProcessId: ctl.subProcessId,
          isHsseCritical: ctl.isHsseCritical,
          ramRating: ctl.ramRating || null,
          riskWeight: ctl.riskWeight,
          rawHealthScore: ctl.rawHealthScore,
          lastTestedDate: ctl.lastTestedDate
            ? new Date(ctl.lastTestedDate)
            : null,
          lastTestResult: ctl.lastTestResult || null,
          controlRef: ctl.controlRef || null,
          sourceFile: ctl.sourceFile || null,
          practiceDocument: ctl.practiceDocument || null,
          controlTypeDetail: ctl.controlTypeDetail || null,
          csfWho: ctl.csfWho || null,
          csfWhat: ctl.csfWhat || null,
          csfWhen: ctl.csfWhen || null,
          csfWhere: ctl.csfWhere || null,
          csfWhy: ctl.csfWhy || null,
          csfHow: ctl.csfHow || null,
          csfEvidence: ctl.csfEvidence || null,
          keyActivities: ctl.keyActivities || null,
          riskAddressed: ctl.riskAddressed || null,
          testingApproach: ctl.testingApproach || null,
          uncertainFlags: ctl.uncertainFlags || null,
          pId: ctl.pId || null,
          standard: ctl.standard || null,
          Requirements: ctl.Requirements || null,
          createdAt: new Date(ctl.createdAt),
        },
      });
    }
    console.log(`   ✅ Restored ${controlsData.length} Controls\n`);

    // Restore Activity Types
    console.log("🎯 Restoring Activity Types...");
    for (const at of activityTypesData) {
      await prisma.assuranceActivityType.create({
        data: {
          id: at.id,
          name: at.name,
          description: at.description || null,
          defaultLOA: at.defaultLOA,
          createdAt: new Date(at.createdAt),
        },
      });
    }
    console.log(`   ✅ Restored ${activityTypesData.length} Activity Types\n`);

    console.log("✨ Restoration Complete!");
    console.log("========================================");
    console.log(
      `✅ Total records restored: ${processAreasData.length + subProcessesData.length + controlsData.length + activityTypesData.length}`
    );
    console.log("   • Process Areas: " + processAreasData.length);
    console.log("   • Sub-Processes: " + subProcessesData.length);
    console.log("   • Controls: " + controlsData.length);
    console.log("   • Activity Types: " + activityTypesData.length);
    console.log("========================================\n");
    console.log("🎉 All data has been restored with original IDs!\n");
  } catch (error) {
    console.error("❌ Restoration failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreData();
