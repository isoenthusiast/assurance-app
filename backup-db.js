/**
 * Full Database Backup — CommonJS version
 * Usage: cd seam-assurance-app && node backup-db.js
 * Output: backup/full_backup_YYYYMMDD_HHmmss.sql
 */
const { readFileSync, writeFileSync, statSync, mkdirSync } = require("fs");
const path = require("path");

// ── Load DATABASE_URL ─────────────────────────────────────────────
try { require("dotenv").config({ path: ".env.local", override: false }); } catch {}
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Create .env.local or set environment variable.");
  process.exit(1);
}

// ── Connect ───────────────────────────────────────────────────────
const { Pool } = require("pg");
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

function quoteIdent(name) { return `"${name}"`; }

function escapeSQL(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function getCreateTableSQL(tableName) {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  const pks = await pool.query(`
    SELECT kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
  `, [tableName]);
  const pkCols = new Set(pks.rows.map(r => r.column_name));
  
  const colDefs = cols.rows.map(r => {
    let def = `  ${quoteIdent(r.column_name)} ${r.data_type.toUpperCase()}`;
    if (pkCols.has(r.column_name)) def += " PRIMARY KEY";
    else if (r.is_nullable === "NO") def += " NOT NULL";
    if (r.column_default) def += ` DEFAULT ${r.column_default}`;
    return def;
  }).join(",\n");
  
  return `DROP TABLE IF EXISTS ${quoteIdent(tableName)} CASCADE;\nCREATE TABLE ${quoteIdent(tableName)} (\n${colDefs}\n);`;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Connecting to database...");
  await pool.query("SELECT 1");
  
  const tables = (await pool.query(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  )).rows.map(r => r.tablename);
  
  console.log(`  Found ${tables.length} tables`);
  
  const ts = new Date().toISOString().replace(/[:.]/g, "").replace("T", "_").slice(0, 15);
  const outDir = path.resolve(__dirname, "..", "backup");
  mkdirSync(outDir, { recursive: true });
  const outputFile = path.join(outDir, `full_backup_${ts}.sql`);
  
  let sql = `-- Full Database Backup\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tables.length}\n\n`;
  
  // Drop
  sql += "-- Drop existing tables\n";
  for (const t of [...tables].reverse()) sql += `DROP TABLE IF EXISTS ${quoteIdent(t)} CASCADE;\n`;
  sql += "\n-- Create tables\n";
  for (const t of tables) sql += await getCreateTableSQL(t) + "\n\n";
  
  // Data
  for (const t of tables) {
    console.log(`📦 ${t}...`);
    const { rows } = await pool.query(`SELECT * FROM ${quoteIdent(t)}`);
    console.log(`  ${rows.length} rows`);
    if (rows.length === 0) continue;
    
    const cols = Object.keys(rows[0]);
    const colNames = cols.map(quoteIdent).join(", ");
    
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      sql += `INSERT INTO ${quoteIdent(t)} (${colNames}) VALUES\n`;
      sql += batch.map(r => "(" + cols.map(c => escapeSQL(r[c])).join(", ") + ")").join(",\n") + ";\n";
    }
    sql += "\n";
  }
  
  writeFileSync(outputFile, sql);
  const kb = (statSync(outputFile).size / 1024).toFixed(1);
  console.log(`\n✅ ${outputFile} (${kb} KB, ${tables.length} tables)`);
  await pool.end();
}

main().catch(e => { console.error("❌", e); process.exit(1); });
