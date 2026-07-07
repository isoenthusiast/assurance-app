/**
 * Migration script: SQLite → PostgreSQL
 * Reads all data from data/dev.db (SQLite) and inserts into PostgreSQL.
 * 
 * Usage: npx tsx prisma/migrate-sqlite-to-pg.ts
 */

import Database from "better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// ── Connect to SQLite ──────────────────────────────────────────────
const sqlite = new Database("data/dev.db");
sqlite.pragma("journal_mode = WAL");

// ── Connect to PostgreSQL via Prisma ────────────────────────────────
const pgAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://seam:seam123@localhost:5432/seam_assurance",
});
const pg = new PrismaClient({ adapter: pgAdapter });

// ── Table order: parents first, then children (respect FK constraints) ──
const TABLE_ORDER = [
  "User",
  "ProcessArea",
  "SubProcess",
  "Control",
  "AssuranceActivityType",
  "AssessmentTemplate",
  "AssessmentTemplateActivityType",
  "AssessmentTemplateControlLinkage",
  "Assessment",
  "ControlAssignment",
  "SampleType",
  "RecordSourceType",
  "Sample",
  "AchievementBadge",
  "UserAchievement",
  "PointTransaction",
  "BehaviorMeasurement",
  "EmotionalDriveMetric",
  "Milestone",
  "ActivityLog",
];

// ── Columns that should NOT be migrated (auto-generated) ────────────
const SKIP_COLUMNS: Record<string, string[]> = {
  // Add table-specific skip columns if needed
};

// ── Type conversions ────────────────────────────────────────────────
function convertValue(value: unknown, colName: string): unknown {
  if (value === null || value === undefined) return null;

  // SQLite stores booleans as 0/1 integers
  if (typeof value === "number" && (value === 0 || value === 1)) {
    const boolColumns = [
      "isMineOnly", "isTemplate", "isActive", "isMandatory",
      "isRequired", "isCompleted", "isDeleted", "isSampled",
      "isDefault",
    ];
    if (boolColumns.includes(colName)) {
      return value === 1;
    }
  }

  // SQLite DateTimes come as strings like "2026-07-01T00:00:00.000Z"
  if (typeof value === "string") {
    const dateColumns = [
      "createdAt", "updatedAt", "startDate", "endDate",
      "completedAt", "assignedAt", "achievedAt", "lastLoginAt",
      "dueDate", "scheduledDate", "timestamp",
    ];
    if (dateColumns.includes(colName) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value);
    }
  }

  return value;
}

// ── Clear PostgreSQL tables (reverse order to respect FK) ──────────
async function clearPostgres() {
  console.log("Clearing PostgreSQL tables...\n");
  const REVERSE_ORDER = [...TABLE_ORDER].reverse();
  
  for (const tableName of REVERSE_ORDER) {
    try {
      await pg.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
      console.log(`  Cleared: ${tableName}`);
    } catch {
      // Table might not exist yet — that's fine
    }
  }
  console.log();
}

// ── Main migration ──────────────────────────────────────────────────
async function migrate() {
  console.log("Starting SQLite → PostgreSQL migration...\n");

  // Clear PG first to avoid FK conflicts with seeded data
  await clearPostgres();

  // Get all tables from SQLite
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name`)
    .all() as { name: string }[];

  console.log(`Found ${tables.length} tables in SQLite: ${tables.map(t => t.name).join(", ")}\n`);

  // Skip tables not in our order list
  const tableNames = new Set(TABLE_ORDER);
  const tablesToMigrate = tables.filter(t => tableNames.has(t.name));

  // Sort by dependency order
  tablesToMigrate.sort((a, b) => TABLE_ORDER.indexOf(a.name) - TABLE_ORDER.indexOf(b.name));

  let totalRows = 0;

  for (const table of tablesToMigrate) {
    const tableName = table.name;

    // Get columns from SQLite
    const columns = sqlite
      .prepare(`PRAGMA table_info("${tableName}")`)
      .all() as { name: string }[];

    const skipCols = SKIP_COLUMNS[tableName] ?? [];
    const colNames = columns.map(c => c.name).filter(c => !skipCols.includes(c));

    // Read all rows
    const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];

    if (rows.length === 0) {
      console.log(`  ${tableName}: 0 rows (empty)`);
      continue;
    }

    console.log(`  ${tableName}: ${rows.length} rows`);

    // Insert into PostgreSQL in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      // Build INSERT statements with ON CONFLICT DO NOTHING
      for (const row of batch) {
        const values: Record<string, unknown> = {};
        for (const col of colNames) {
          values[col] = convertValue(row[col], col);
        }

        try {
          // Use Prisma raw query for each row (not ideal for perf, but safe)
          const columns_quoted = colNames.map(c => `"${c}"`).join(", ");
          const placeholders = colNames.map((_, idx) => `$${idx + 1}`).join(", ");
          const sql = `INSERT INTO "${tableName}" (${columns_quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

          await pg.$executeRawUnsafe(sql, ...colNames.map(c => values[c]));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`    Error inserting into ${tableName}: ${message}`);
          console.error(`    Row: ${JSON.stringify(values).slice(0, 200)}`);
        }
      }
    }

    totalRows += rows.length;
  }

  console.log(`\n✅ Migration complete: ${totalRows} rows across ${tablesToMigrate.length} tables`);
}

migrate()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await pg.$disconnect();
  });
