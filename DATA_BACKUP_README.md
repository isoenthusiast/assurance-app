# Data Backup & Restoration Guide

This guide explains how to backup and restore the 4 critical tables:
- **ProcessArea**
- **SubProcess**
- **Control**
- **AssuranceActivityType**

All data is preserved with original IDs and relationships intact.

## Quick Start

### Step 1: Export Current Data

Run this command to backup all critical data to JSON files:

```powershell
npx ts-node scripts/export-critical-data.ts
```

**Output:**
- `data/ProcessAreas.json` - All process areas
- `data/SubProcesses.json` - All sub-processes
- `data/Controls.json` - All controls
- `data/ActivityTypes.json` - All activity types
- `data/BACKUP_METADATA.json` - Backup metadata with timestamps

### Step 2: Restore Data (After Reset or Migration)

After running `npx prisma migrate reset`, restore your data:

```powershell
npx ts-node scripts/restore-critical-data.ts
```

This will:
- ✅ Restore all ProcessAreas with original IDs
- ✅ Restore all SubProcesses with relationships
- ✅ Restore all Controls (28 fields preserved)
- ✅ Restore all ActivityTypes with original IDs

## Workflow Example

```powershell
# 1. Before making changes, backup your data
npx ts-node scripts/export-critical-data.ts

# 2. Reset database and apply migrations
npx prisma migrate reset

# 3. Restore your data
npx ts-node scripts/restore-critical-data.ts

# 4. Start dev server
npm run dev
```

## Files

### Export Script
**Location:** `scripts/export-critical-data.ts`

Exports current database records to JSON format in the `data/` directory.

**Run:**
```powershell
npx ts-node scripts/export-critical-data.ts
```

### Restoration Script
**Location:** `scripts/restore-critical-data.ts`

Reads JSON backup files and restores all records with original IDs.

**Run:**
```powershell
npx ts-node scripts/restore-critical-data.ts
```

## What's Preserved

### ProcessArea
- ✅ ID (custom UUID)
- ✅ Name
- ✅ Description
- ✅ pId (Process Identifier)
- ✅ Standard (e.g., "ISO 27001")
- ✅ createdAt timestamp

### SubProcess
- ✅ ID
- ✅ Name
- ✅ Description
- ✅ processAreaId (relationship)
- ✅ createdAt

### Control (28 fields)
- ✅ ID, Name, Statement
- ✅ Control Type & Type Detail
- ✅ Process Area & Sub-Process (relationships)
- ✅ HSSE Critical flag
- ✅ RAM Rating, Risk Weight, Health Score
- ✅ Last Tested Date & Result
- ✅ Control Ref, Source File, Practice Document
- ✅ CSF Fields (Who, What, When, Where, Why, How, Evidence)
- ✅ Key Activities, Risk Addressed
- ✅ Testing Approach, Uncertain Flags
- ✅ pId, Standard, Requirements
- ✅ createdAt

### AssuranceActivityType
- ✅ ID
- ✅ Name
- ✅ Description
- ✅ Default LOA (Line of Assurance)
- ✅ createdAt

## Troubleshooting

### "Backup file not found"
**Problem:** You haven't exported data yet
**Solution:** Run `npx ts-node scripts/export-critical-data.ts` first

### "Foreign key constraint violated"
**Problem:** Trying to restore before tables exist
**Solution:** Ensure migration is complete: `npx prisma migrate dev`

### "Duplicate key error"
**Problem:** Data already exists in database
**Solution:** Clear the database first: `npx prisma migrate reset`

## Manual Backup

If you prefer to use the existing export_database.py script (exports all tables):

```powershell
python export_database.py
```

This creates files in `dbBackup/` directory for all tables.

## Best Practices

1. **Before making schema changes:**
   ```powershell
   npx ts-node scripts/export-critical-data.ts
   ```

2. **Before resetting database:**
   ```powershell
   npx ts-node scripts/export-critical-data.ts
   ```

3. **Keep backups in version control:**
   ```powershell
   git add data/*.json
   git commit -m "Data backup before migration"
   ```

4. **Verify restoration:**
   - Check that row counts match the metadata
   - Verify critical records are present
   - Test assessment creation still works

## Advanced: Custom Restoration

To restore only specific tables, edit `restore-critical-data.ts` and comment out the tables you don't need.

For example, to restore only ProcessAreas:

```typescript
// Comment out these loops:
// restoreSubProcesses()
// restoreControls()
// restoreActivityTypes()

// Keep this:
restoreProcessAreas()
```

---

**Last Updated:** June 30, 2026
**Schema Version:** 1.7.0 (Decoupled Controls & Samples)
