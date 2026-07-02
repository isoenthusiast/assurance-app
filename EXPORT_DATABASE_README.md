# Database Export Instructions

This guide explains how to extract all database tables into JSON backup files.

## Quick Start

### Option 1: Standalone Script (Recommended - Most Compatible)

Requires only Node.js and sqlite3 CLI (most systems have sqlite3):

```bash
cd seam-assurance-app
node export-db-standalone.js
```

### Option 2: Using Prisma Script

If you have Prisma set up:

```bash
cd seam-assurance-app
npx prisma generate
node scripts/export-database.js
```

### Option 3: Simple Script with better-sqlite3

Requires additional module installation:

```bash
cd seam-assurance-app
npm install better-sqlite3
node export-db-simple.js
```

**What it does:**
- Connects to your SQLite database via Prisma
- Exports all 18 tables to JSON files
- Creates one JSON file per table with format: `dbbackup_[TableName]_YYYY-MM-DD.json`
- Generates a summary file: `dbbackup_EXPORT_SUMMARY_YYYY-MM-DD.json`
- Saves all files to `../dbBackup/` directory

**Output example:**
```
📦 Starting database export...

✓ User                                   :      5 rows → dbbackup_User_2026-06-27.json
✓ ProcessArea                            :     64 rows → dbbackup_ProcessArea_2026-06-27.json
✓ Control                                :      0 rows → dbbackup_Control_2026-06-27.json
...

✅ DATABASE EXPORT COMPLETE
=======================================================================
📊 Tables exported    : 18
📈 Total rows         : 547
⏱️  Time taken         : 1234ms
📁 Backup directory   : C:\Users\edwar\Claude\Projects\Gamified Plant\dbBackup
📋 Summary file       : dbbackup_EXPORT_SUMMARY_2026-06-27.json
=======================================================================
```

### Option 2: Using API Endpoint

If you prefer to use the API, a new endpoint is available:

```bash
curl -X GET http://localhost:3000/api/admin/export-all-tables \
  -H "Cookie: [your-session-cookie]"
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-06-27T21:45:24.000Z",
  "exportSummary": {
    "User": 5,
    "ProcessArea": 64,
    "Control": 0,
    ...
  },
  "tables": {
    "User": [...],
    "ProcessArea": [...],
    ...
  }
}
```

## Tables Exported

The script exports all 18 tables from your Prisma schema:

### Core Tables
- `User` - User accounts with gamification fields
- `ProcessArea` - Top-level process groupings
- `SubProcess` - Sub-processes within process areas
- `Control` - Control definitions (28 fields each)
- `Assessment` - Assessment instances
- `Sample` - Test samples within assessments

### Lookup Tables
- `AssuranceActivityType` - LOA definitions (FirstLine, SecondLine, ThirdLine)
- `SampleType` - Custom sample type values
- `RecordSourceType` - Custom record source values

### Template System
- `AssessmentTemplate` - Reusable assessment blueprints
- `AssessmentTemplateControlLinkage` - Control-to-template mapping
- `AssessmentTemplateActivityType` - Activity type-to-template mapping

### Gamification Tables
- `AchievementBadge` - Badge definitions
- `UserAchievement` - User badge progress
- `PointTransaction` - Points history
- `BehaviorMeasurement` - Daily behavior tracking
- `EmotionalDriveMetric` - Drive score rollups
- `Milestone` - User progression milestones

## JSON File Format

Each exported JSON file has this structure:

```json
{
  "table": "ProcessArea",
  "timestamp": "2026-06-27T21:45:24.000Z",
  "rowCount": 64,
  "data": [
    {
      "id": "pa_1782473463181_9",
      "name": "Water in the Environment",
      "description": "Water in the Environment",
      "pId": "1.10",
      "standard": "ISO 14001",
      "createdAt": "2026-06-26T11:31:03.182Z"
    },
    ...
  ]
}
```

## Summary File Format

The export creates a summary file for tracking:

```json
{
  "exportTimestamp": "2026-06-27T21:45:24.000Z",
  "totalTables": 18,
  "totalRows": 547,
  "exportDurationMs": 1234,
  "backupDirectory": "C:\\Users\\edwar\\Claude\\Projects\\Gamified Plant\\dbBackup",
  "tables": {
    "User": 5,
    "ProcessArea": 64,
    "SubProcess": 189,
    "Control": 0,
    "Assessment": 0,
    "Sample": 0,
    "AssuranceActivityType": 24,
    "SampleType": 2,
    "RecordSourceType": 1,
    ...
  }
}
```

## Key Features

✅ **Complete Data Export** - All tables and rows exported  
✅ **Formatted JSON** - Human-readable with 2-space indentation  
✅ **Timestamped Files** - YYYY-MM-DD format prevents overwrites  
✅ **Summary Report** - Track what was exported  
✅ **Detailed Logging** - See progress as it exports  
✅ **Error Handling** - Continues if a table fails  
✅ **Row Counts** - Includes row count metadata in each file  

## Files Created

```
dbBackup/
├── dbbackup_User_2026-06-27.json
├── dbbackup_ProcessArea_2026-06-27.json
├── dbbackup_SubProcess_2026-06-27.json
├── dbbackup_Control_2026-06-27.json
├── dbbackup_Assessment_2026-06-27.json
├── dbbackup_Sample_2026-06-27.json
├── dbbackup_AssuranceActivityType_2026-06-27.json
├── dbbackup_SampleType_2026-06-27.json
├── dbbackup_RecordSourceType_2026-06-27.json
├── dbbackup_AssessmentTemplate_2026-06-27.json
├── dbbackup_AssessmentTemplateControlLinkage_2026-06-27.json
├── dbbackup_AssessmentTemplateActivityType_2026-06-27.json
├── dbbackup_AchievementBadge_2026-06-27.json
├── dbbackup_UserAchievement_2026-06-27.json
├── dbbackup_PointTransaction_2026-06-27.json
├── dbbackup_BehaviorMeasurement_2026-06-27.json
├── dbbackup_EmotionalDriveMetric_2026-06-27.json
├── dbbackup_Milestone_2026-06-27.json
└── dbbackup_EXPORT_SUMMARY_2026-06-27.json
```

## Troubleshooting

### "Cannot find module '@prisma/client'"
- Run `npm install` first
- Or use the API endpoint instead

### "ENOENT: no such file or directory"
- Ensure the `dbBackup` directory exists
- Script creates it automatically if missing

### "DATABASE_URL not set"
- Ensure your `.env.local` has `DATABASE_URL="file:./prisma/dev.db"`
- Or set it in your environment: `export DATABASE_URL="file:./prisma/dev.db"`

### Empty export (0 rows for some tables)
- This is normal - not all tables may have data
- Check the summary file to see what was exported

## Use Cases

- **Data Backup** - Regular snapshots of database state
- **Version Control** - Track schema and data changes over time
- **Archival** - Keep historical records of database state
- **Analysis** - Import exported data into analytics tools
- **Migration** - Use JSON files to migrate to different systems
- **Documentation** - Reference snapshots of data structure

## Automation

To run this daily, add to a cron job or scheduled task:

**Linux/Mac:**
```bash
0 2 * * * cd /path/to/seam-assurance-app && node scripts/export-database.js
```

**Windows (Task Scheduler):**
```
Program: C:\Program Files\nodejs\node.exe
Arguments: scripts\export-database.js
Start in: C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app
```

---

**Last Updated:** June 27, 2026  
**Script Version:** 1.0  
**Status:** Production Ready
