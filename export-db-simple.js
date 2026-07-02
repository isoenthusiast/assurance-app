#!/usr/bin/env node

/**
 * Simple Database Export Script
 * Exports database tables to JSON files using Prisma CLI
 *
 * Usage:
 *   node export-db-simple.js
 *
 * First time setup:
 *   npm install
 *   npx prisma generate
 *   node export-db-simple.js
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const dbBackupDir = path.join(projectRoot, "..", "dbBackup");

// Ensure backup directory exists
if (!fs.existsSync(dbBackupDir)) {
  fs.mkdirSync(dbBackupDir, { recursive: true });
  console.log(`✓ Created backup directory: ${dbBackupDir}\n`);
}

console.log("📦 Starting database export via Prisma...\n");

// Tables to export in order
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
let completedTables = 0;

async function exportTable(tableName) {
  return new Promise((resolve) => {
    // Use Prisma's raw query capability via npx prisma db execute
    const prismaCmd = spawn("npx", [
      "prisma",
      "query",
      "--stdin",
      `SELECT * FROM "${tableName}" LIMIT 100000;`,
    ]);

    let output = "";
    let errorOutput = "";

    prismaCmd.stdout.on("data", (data) => {
      output += data.toString();
    });

    prismaCmd.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    prismaCmd.on("close", (code) => {
      if (code === 0 && output) {
        try {
          const data = JSON.parse(output);
          const filename = `dbbackup_${tableName}_${timestamp}.json`;
          const filepath = path.join(dbBackupDir, filename);

          const exportData = {
            table: tableName,
            timestamp: new Date().toISOString(),
            rowCount: Array.isArray(data) ? data.length : 1,
            data: data,
          };

          fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
          exportSummary[tableName] = Array.isArray(data) ? data.length : 0;
          console.log(`✓ ${tableName.padEnd(40)} : ${exportSummary[tableName].toString().padStart(6)} rows`);
          completedTables++;
        } catch (e) {
          exportSummary[tableName] = 0;
          console.log(`⚠ ${tableName.padEnd(40)} : Could not parse (empty or error)`);
        }
      } else {
        exportSummary[tableName] = 0;
        console.log(`✗ ${tableName.padEnd(40)} : Export failed`);
      }
      resolve();
    });
  });
}

async function runExport() {
  const startTime = Date.now();

  // Export all tables sequentially
  for (const table of tables) {
    await exportTable(table);
  }

  // Create summary file
  const totalRows = Object.values(exportSummary).reduce((a, b) => a + b, 0);
  const duration = Date.now() - startTime;
  const summaryFilename = `dbbackup_EXPORT_SUMMARY_${timestamp}.json`;
  const summaryFilepath = path.join(dbBackupDir, summaryFilename);

  const summary = {
    exportTimestamp: new Date().toISOString(),
    totalTables: Object.keys(exportSummary).length,
    totalRows: totalRows,
    exportDurationMs: duration,
    tables: exportSummary,
  };

  fs.writeFileSync(summaryFilepath, JSON.stringify(summary, null, 2));

  // Print summary
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
      if (count > 0 || true) {
        console.log(`  dbbackup_${table}_${timestamp}.json (${count} rows)`);
      }
    });
  console.log(`  ${summaryFilename}`);
  console.log("");
}

// Alternative: Use TypeScript/Node approach with Prisma
console.log("⏳ Attempting to load Prisma client...\n");

// Simple fallback: direct SQLite query
const Database = require("better-sqlite3");
const dbPath = path.join(projectRoot, "prisma", "dev.db");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  console.error("\nPlease ensure:");
  console.error("1. The database exists at prisma/dev.db");
  console.error("2. You've run: npm install");
  console.error("3. You've run: npx prisma migrate dev (or similar)");
  process.exit(1);
}

try {
  const db = new Database(dbPath, { readonly: true });

  console.log(`✓ Connected to SQLite database\n`);

  const startTime = Date.now();
  let totalRows = 0;

  for (const tableName of tables) {
    try {
      const stmt = db.prepare(`SELECT * FROM "${tableName}"`);
      const data = stmt.all();
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
      totalRows += data.length;
      console.log(`✓ ${tableName.padEnd(40)} : ${data.length.toString().padStart(6)} rows → dbbackup_${tableName}_${timestamp}.json`);
    } catch (err) {
      exportSummary[tableName] = 0;
      console.log(`⚠ ${tableName.padEnd(40)} : ${err.message.substring(0, 40)}`);
    }
  }

  db.close();

  // Create summary
  const duration = Date.now() - startTime;
  const summaryFilename = `dbbackup_EXPORT_SUMMARY_${timestamp}.json`;
  const summaryFilepath = path.join(dbBackupDir, summaryFilename);

  const summary = {
    exportTimestamp: new Date().toISOString(),
    totalTables: Object.keys(exportSummary).length,
    totalRows: totalRows,
    exportDurationMs: duration,
    backupDirectory: dbBackupDir,
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

  console.log("All files created:");
  Object.entries(exportSummary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([table, count]) => {
      const icon = count > 0 ? "✓" : "○";
      console.log(`  ${icon} dbbackup_${table}_${timestamp}.json (${count} rows)`);
    });
  console.log(`  📋 ${summaryFilename}\n`);

  process.exit(0);
} catch (error) {
  console.error("\n❌ Export failed:", error.message);

  // Try to give helpful advice
  if (error.message.includes("Cannot find module")) {
    console.error("\n📝 To fix this, run:");
    console.error("   npm install better-sqlite3");
    console.error("   node export-db-simple.js");
  }

  process.exit(1);
}
