#!/usr/bin/env node

/**
 * Database Export Script
 * Exports all Prisma tables to JSON files in ../dbBackup directory
 *
 * Usage:
 *   node scripts/export-database.js
 *
 * Requirements:
 *   - Node.js with Prisma installed
 *   - DATABASE_URL environment variable set
 *   - Run `npx prisma generate` first if getting module errors
 */

const fs = require("fs");
const path = require("path");

async function main() {
  try {
    // Import Prisma - using require instead of import for better compatibility
    let prisma;
    try {
      // Try to require the already-generated Prisma client
      const PrismaModule = require("@prisma/client");
      const { PrismaClient } = PrismaModule;
      prisma = new PrismaClient();
    } catch (importErr) {
      console.error("⚠️  Error loading Prisma client. Attempting to use SQLite directly...\n");

      // Fallback: Use SQLite directly
      const sqlite3 = require("sqlite3").verbose();
      const dbPath = path.join(__dirname, "..", "prisma", "dev.db");

      if (!fs.existsSync(dbPath)) {
        throw new Error(`Database not found at ${dbPath}`);
      }

      console.log(`Using SQLite directly from: ${dbPath}\n`);
      throw new Error(
        "Please run: npm install\nThen run: npx prisma generate\nThen run this script again."
      );
    }

    const dbBackupDir = path.join(__dirname, "..", "..", "dbBackup");

    // Ensure directory exists
    if (!fs.existsSync(dbBackupDir)) {
      fs.mkdirSync(dbBackupDir, { recursive: true });
    }

    const tables = [
      { name: "User", model: "user" },
      { name: "ProcessArea", model: "processArea" },
      { name: "SubProcess", model: "subProcess" },
      { name: "Control", model: "control" },
      { name: "Assessment", model: "assessment" },
      { name: "Sample", model: "sample" },
      { name: "AssuranceActivityType", model: "assuranceActivityType" },
      { name: "SampleType", model: "sampleType" },
      { name: "RecordSourceType", model: "recordSourceType" },
      { name: "AssessmentTemplate", model: "assessmentTemplate" },
      { name: "AssessmentTemplateControlLinkage", model: "assessmentTemplateControlLinkage" },
      { name: "AssessmentTemplateActivityType", model: "assessmentTemplateActivityType" },
      { name: "AchievementBadge", model: "achievementBadge" },
      { name: "UserAchievement", model: "userAchievement" },
      { name: "PointTransaction", model: "pointTransaction" },
      { name: "BehaviorMeasurement", model: "behaviorMeasurement" },
      { name: "EmotionalDriveMetric", model: "emotionalDriveMetric" },
      { name: "Milestone", model: "milestone" },
    ];

    console.log("\n📦 Starting database export...\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("-").slice(0, 3).join("-");
    const exportSummary = {};
    const startTime = Date.now();

    for (const { name, model } of tables) {
      try {
        const data = await prisma[model].findMany();
        const filename = `dbbackup_${name}_${timestamp}.json`;
        const filepath = path.join(dbBackupDir, filename);

        const exportData = {
          table: name,
          timestamp: new Date().toISOString(),
          rowCount: data.length,
          data: data,
        };

        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
        exportSummary[name] = data.length;
        console.log(`✓ ${name.padEnd(40)} : ${data.length.toString().padStart(6)} rows → ${filename}`);
      } catch (err) {
        console.error(`✗ ${name.padEnd(40)} : ${err.message}`);
        exportSummary[name] = 0;
      }
    }

    // Create summary file
    const summaryFilename = `dbbackup_EXPORT_SUMMARY_${timestamp}.json`;
    const summaryFilepath = path.join(dbBackupDir, summaryFilename);
    const totalRows = Object.values(exportSummary).reduce((a, b) => a + b, 0);
    const duration = Date.now() - startTime;

    const summary = {
      exportTimestamp: new Date().toISOString(),
      totalTables: Object.keys(exportSummary).length,
      totalRows: totalRows,
      exportDurationMs: duration,
      backupDirectory: dbBackupDir,
      tables: exportSummary,
    };

    fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

    console.log("\n" + "=".repeat(70));
    console.log("✅ DATABASE EXPORT COMPLETE");
    console.log("=".repeat(70));
    console.log(`📊 Tables exported    : ${Object.keys(exportSummary).length}`);
    console.log(`📈 Total rows         : ${totalRows.toLocaleString()}`);
    console.log(`⏱️  Time taken         : ${duration}ms`);
    console.log(`📁 Backup directory   : ${dbBackupDir}`);
    console.log(`📋 Summary file       : ${summaryFilename}`);
    console.log("=".repeat(70) + "\n");

    console.log("Breakdown by table:");
    console.log("-".repeat(70));
    Object.entries(exportSummary)
      .sort((a, b) => b[1] - a[1])
      .forEach(([table, count]) => {
        console.log(`  ${table.padEnd(40)} : ${count.toString().padStart(6)} rows`);
      });
    console.log("-".repeat(70) + "\n");

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Export failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
