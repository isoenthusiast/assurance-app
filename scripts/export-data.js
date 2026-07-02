/**
 * Export Script: Backup the 4 critical tables
 * Run: node scripts/export-data.js
 */

const { PrismaClient } = require("../prisma/.prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function exportData() {
  const dataDir = path.join(__dirname, "../data");

  // Create data directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    console.log("📦 Exporting critical data...\n");

    // Export ProcessAreas
    console.log("📁 Exporting Process Areas...");
    const processAreas = await prisma.processArea.findMany({
      orderBy: { createdAt: "asc" },
    });
    fs.writeFileSync(
      path.join(dataDir, "ProcessAreas.json"),
      JSON.stringify(processAreas, null, 2)
    );
    console.log(`   ✅ Exported ${processAreas.length} Process Areas\n`);

    // Export SubProcesses
    console.log("📂 Exporting Sub-Processes...");
    const subProcesses = await prisma.subProcess.findMany({
      orderBy: { createdAt: "asc" },
    });
    fs.writeFileSync(
      path.join(dataDir, "SubProcesses.json"),
      JSON.stringify(subProcesses, null, 2)
    );
    console.log(`   ✅ Exported ${subProcesses.length} Sub-Processes\n`);

    // Export Controls
    console.log("✓ Exporting Controls...");
    const controls = await prisma.control.findMany({
      orderBy: [{ processArea: { name: "asc" } }, { name: "asc" }],
    });
    fs.writeFileSync(
      path.join(dataDir, "Controls.json"),
      JSON.stringify(controls, null, 2)
    );
    console.log(`   ✅ Exported ${controls.length} Controls\n`);

    // Export Activity Types
    console.log("🎯 Exporting Activity Types...");
    const activityTypes = await prisma.assuranceActivityType.findMany({
      orderBy: { name: "asc" },
    });
    fs.writeFileSync(
      path.join(dataDir, "ActivityTypes.json"),
      JSON.stringify(activityTypes, null, 2)
    );
    console.log(`   ✅ Exported ${activityTypes.length} Activity Types\n`);

    // Create metadata file
    const metadata = {
      exportedAt: new Date().toISOString(),
      tables: {
        ProcessArea: processAreas.length,
        SubProcess: subProcesses.length,
        Control: controls.length,
        AssuranceActivityType: activityTypes.length,
      },
      totalRecords:
        processAreas.length +
        subProcesses.length +
        controls.length +
        activityTypes.length,
    };

    fs.writeFileSync(
      path.join(dataDir, "BACKUP_METADATA.json"),
      JSON.stringify(metadata, null, 2)
    );

    console.log("✨ Export Complete!");
    console.log("========================================");
    console.log(`📊 Total records exported: ${metadata.totalRecords}`);
    console.log(`📁 Backup location: ${dataDir}`);
    console.log(`⏰ Exported at: ${metadata.exportedAt}`);
    console.log("========================================\n");
    console.log("📝 To restore this data later, run:");
    console.log("   node scripts/restore-data.js\n");
  } catch (error) {
    console.error("❌ Export failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
