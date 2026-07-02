# Python Database Export Script

Simple, no-dependency Python script to export all SQLite database tables to JSON files.

## Quick Start

```bash
cd "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app"
python export_database.py
```

That's it! No dependencies needed - uses only Python's built-in `sqlite3` and `json` modules.

## What It Does

✅ Connects to `prisma/dev.db`  
✅ Gets all table names automatically  
✅ Exports each table to JSON format  
✅ Saves files as `dbbackup_[TableName]_YYYY-MM-DD.json`  
✅ Creates summary file with export metadata  
✅ Displays detailed progress output  
✅ Shows row counts per table  

## Output

Files are saved to the `../dbBackup/` directory:

```
dbBackup/
├── dbbackup_User_2026-06-27.json              (5 rows)
├── dbbackup_ProcessArea_2026-06-27.json       (64 rows)
├── dbbackup_SubProcess_2026-06-27.json        (189 rows)
├── dbbackup_Control_2026-06-27.json           (0 rows)
├── dbbackup_Assessment_2026-06-27.json        (0 rows)
├── dbbackup_Sample_2026-06-27.json            (0 rows)
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

## JSON File Format

Each file contains:

```json
{
  "table": "ProcessArea",
  "timestamp": "2026-06-27T21:45:24.123456",
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

## Summary File

Also creates `dbbackup_EXPORT_SUMMARY_YYYY-MM-DD.json`:

```json
{
  "exportTimestamp": "2026-06-27T21:45:24.123456",
  "databaseFile": "C:\\...\\prisma\\dev.db",
  "backupDirectory": "C:\\...\\dbBackup",
  "totalTables": 18,
  "totalRows": 547,
  "exportDurationMs": 1234,
  "tables": {
    "User": 5,
    "ProcessArea": 64,
    "SubProcess": 189,
    ...
  }
}
```

## Requirements

- **Python 3.6+** (any version)
- That's it! No pip packages needed

## Example Output

```
📦 Starting database export...

📁 Database: C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app\prisma\dev.db
💾 Output:   C:\Users\edwar\Claude\Projects\Gamified Plant\dbBackup

Found 18 tables to export:

✓ AssessmentTemplate              :      0 rows
✓ AssessmentTemplateActivityType  :      0 rows
✓ AssessmentTemplateControlLinkage :     0 rows
✓ Assessment                       :      0 rows
✓ AchievementBadge                :      0 rows
✓ BehaviorMeasurement             :      0 rows
✓ Control                          :      0 rows
✓ EmotionalDriveMetric            :      0 rows
✓ Milestone                        :      0 rows
✓ PointTransaction                :      0 rows
✓ ProcessArea                      :     64 rows
✓ RecordSourceType                :      1 rows
✓ Sample                           :      0 rows
✓ SampleType                       :      2 rows
✓ SubProcess                       :    189 rows
✓ User                             :      5 rows
✓ UserAchievement                 :      0 rows
✓ AssuranceActivityType           :     24 rows

======================================================================
✅ DATABASE EXPORT COMPLETE
======================================================================
📊 Tables exported    : 18
📈 Total rows         : 285
⏱️  Time taken         : 234ms
📁 Backup directory   : C:\Users\edwar\Claude\Projects\Gamified Plant\dbBackup
📋 Summary file       : dbbackup_EXPORT_SUMMARY_2026-06-27.json
======================================================================

Files created:
  ✓ dbbackup_AssuranceActivityType_2026-06-27.json (24 rows)
  ✓ dbbackup_ProcessArea_2026-06-27.json (64 rows)
  ✓ dbbackup_SubProcess_2026-06-27.json (189 rows)
  ○ dbbackup_Control_2026-06-27.json (0 rows)
  ... (13 more files)
  📋 dbbackup_EXPORT_SUMMARY_2026-06-27.json

✨ Database backup complete! All files saved to dbBackup folder.
```

## Automation

### Windows - Schedule Task

Create a batch file `export_backup.bat`:
```batch
@echo off
cd /d "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app"
python export_database.py
```

Then schedule it in Task Scheduler to run daily.

### Linux/Mac - Cron Job

Add to crontab:
```bash
0 2 * * * cd /path/to/seam-assurance-app && python export_database.py
```

This runs the export daily at 2 AM.

## Troubleshooting

### "Python not found"
Make sure Python is installed and in your PATH:
```bash
python --version
```

If it shows Python 3.6+, you're good to go.

### "Database not found"
Make sure you're running from the correct directory. The script looks for:
```
seam-assurance-app/
└── prisma/
    └── dev.db
```

### "Permission denied"
On Linux/Mac, make the script executable:
```bash
chmod +x export_database.py
```

## Notes

- The script discovers all tables automatically from the database
- Non-serializable objects (bytes, dates) are automatically converted to strings
- Each export includes a timestamp to prevent overwriting previous backups
- The summary file helps track what was backed up and when
- All JSON is pretty-printed with 2-space indentation for readability

---

**That's it!** One command, no setup, complete database backup. 🎉
