#!/usr/bin/env node

/**
 * Standalone Database Export Script
 * Exports SQLite database tables to JSON files
 * No external dependencies required (besides sqlite3 CLI)
 *
 * Usage:
 *   node export-db-standalone.js
 *
 * Note: Requires sqlite3 to be installed on your system
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const dbPath = path.join(projectRoot, "prisma", "dev.db");
const dbBackupDir = path.join(projectRoot, "..", "dbBackup");

// Ensure backup directory exists
if (!fs.existsSync(dbBackupDir)) {
  fs.mkdirSync(dbBackupDir, { recursive: true });
}

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  console.error("\nPlease ensure the database file exists in: prisma/dev.db");
  process.exit(1);
}

console.log("\n📦 Starting SQLite database export...\n");
console.log(`📁 Database: ${dbPath}`);
console.log(`💾 Output:   ${dbBackupDir}\n`);

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
  "BehaviorMeasurement",
  "EmotionalDriveMetric",
  "Milestone",
];

const timestamp = new Date().toISOString().split("T")[0];
const exportSummary = {};
let totalRows = 0;
const startTime = Date.now();

// Export each table using sqlite3 CLI with JSON output
for (const table of tables) {
  try {
    // Use sqlite3 CLI to export table as JSON
    const query = `.mode json\nSELECT * FROM "${table}";`;
    let jsonOutput = "";

    try {
      jsonOutput = execSync(`echo "${query}" | sqlite3 "${dbPath}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      // If that fails, try alternative syntax
      jsonOutput = execSync(`sqlite3 "${dbPath}" "${query}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }

    if (jsonOutput.trim()) {
      try {
        const data = JSON.parse(jsonOutput);
        const rowCount = Array.isArray(data) ? data.length : 0;

        const exportData = {
          table: table,
          timestamp: new Date().toISOString(),
          rowCount: rowCount,
          data: data,
        };

        const filename = `dbbackup_${table}_${timestamp}.json`;
        const filepath = path.join(dbBackupDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

        exportSummary[table] = rowCount;
        totalRows += rowCount;
        console.log(`✓ ${table.padEnd(40)} : ${rowCount.toString().padStart(6)} rows`);
      } catch (parseErr) {
        console.log(`⚠ ${table.padEnd(40)} : Exported but couldn't parse JSON`);
        exportSummary[table] = 0;
      }
    } else {
      console.log(`○ ${table.padEnd(40)} : Table empty or not found`);
      exportSummary[table] = 0;
    }
  } catch (error) {
    console.log(`✗ ${table.padEnd(40)} : ${error.message.substring(0, 40)}`);
    exportSummary[table] = 0;
  }
}

// Create summary file
const duration = Date.now() - startTime;
const summaryFilename = `dbbackup_EXPORT_SUMMARY_${timestamp}.json`;
const summaryFilepath = path.join(dbBackupDir, summaryFilename);

const summary = {
  exportTimestamp: new Date().toISOString(),
  databaseFile: dbPath,
  backupDirectory: dbBackupDir,
  totalTables: Object.keys(exportSummary).length,
  totalRows: totalRows,
  exportDurationMs: duration,
  tables: exportSummary,
};

fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

// Print results
console.log("\n" + "=".repeat(70));
console.log("✅ DATABASE EXPORT COMPLETE");
console.log("=".repeat(70));
console.log(`📊 Tables exported    : ${Object.keys(exportSummary).length}`);
console.log(`📈 Total rows         : ${totalRows.toLocaleString()}`);
console.log(`⏱️  Time taken         : ${duration}ms`);
console.log(`📁 Backup directory   : ${dbBackupDir}`);
console.log(`📋 Summary file       : ${summaryFilename}`);
console.log("=".repeat(70) + "\n");

console.log("Files created:");
Object.entries(exportSummary)
  .sort((a, b) => b[1] - a[1])
  .forEach(([table, count]) => {
    const icon = count > 0 ? "✓" : "○";
    console.log(`  ${icon} dbbackup_${table}_${timestamp}.json (${count} rows)`);
  });
console.log(`  📋 ${summaryFilename}\n`);

console.log("✨ Database backup complete! All files saved to dbBackup folder.\n");

process.exit(0);
