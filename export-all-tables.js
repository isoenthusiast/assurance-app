#!/usr/bin/env node

/**
 * Database Export Script
 * Exports all database tables to JSON files in dbBackup directory
 * Usage: node export-all-tables.js
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dbBackupDir = path.join(__dirname, "..", "dbBackup");

// Ensure dbBackup directory exists
if (!fs.existsSync(dbBackupDir)) {
  fs.mkdirSync(dbBackupDir, { recursive: true });
  console.log(`✓ Created backup directory: ${dbBackupDir}`);
}

const tables = [
  "User",
  "ProcessArea",
  "SubProcess",
  "Control",
  "Assessment",
  "Sample",
  "AssuranceActivityType",
  "SampleType",
  "RecordSourceType",
  "AssessmentTemplate",
  "AssessmentTemplateControlLinkage",
  "AssessmentTemplateActivityType",
  "AchievementBadge",
  "UserAchievement",
  "PointTransaction",
  "EmotionalDriveMetric",
  "Milestone",
];

async function exportAllTables() {
  console.log("\n📦 Starting database export...\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const exportSummary = {};
  const startTime = Date.now();

  try {
    for (const tableName of tables) {
      try {
        const modelName = tableName.charAt(0).toLowerCase() + tableName.slice(1);
        const model = prisma[modelName];

        if (!model || typeof model.findMany !== "function") {
          console.warn(`⚠️  Table ${tableName}: Not found or not queryable`);
          continue;
        }

        const data = await model.findMany();
        const filename = `dbbackup_${tableName}_${timestamp}.json`;
        const filepath = path.join(dbBackupDir, filename);

        const exportData = {
          table: tableName,
          timestamp: new Date().toISOString(),
          rowCount: data.length,
          data: data,
        };

        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
        exportSummary[tableName] = data.length;
        console.log(`✓ ${tableName}: ${data.length} rows exported → ${filename}`);
      } catch (err) {
        console.error(`✗ ${tableName}: ${err.message}`);
        exportSummary[tableName] = 0;
      }
    }

    // Create a summary file
    const summaryFilename = `dbbackup_EXPORT_SUMMARY_${timestamp}.json`;
    const summaryFilepath = path.join(dbBackupDir, summaryFilename);
    const summary = {
      exportTimestamp: new Date().toISOString(),
      totalTables: Object.keys(exportSummary).length,
      totalRows: Object.values(exportSummary).reduce((a, b) => a + b, 0),
      exportDuration: `${Date.now() - startTime}ms`,
      tables: exportSummary,
    };

    fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));
    console.log(`\n📋 Summary file created → ${summaryFilename}`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ EXPORT COMPLETE");
    console.log("=".repeat(60));
    console.log(`Total tables: ${Object.keys(exportSummary).length}`);
    console.log(`Total rows exported: ${summary.totalRows}`);
    console.log(`Time taken: ${summary.exportDuration}`);
    console.log(`Location: ${dbBackupDir}`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Export failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllTables();
