# Database Backup Log

**Last Backup:** June 25, 2026  
**App Version:** 1.1  
**Migration Status:** Latest (clean migration applied)

---

## Backup Instructions (Windows)

### Manual Backup (Recommended)

1. **Navigate to project folder:**
   ```bash
   cd "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app"
   ```

2. **Copy database with current date/time:**
   ```bash
   copy dev.db "dev.db.backup.20260625_final"
   ```

3. **Verify backup was created:**
   ```bash
   dir dev.db*
   ```

### Automated Backup Script (PowerShell)

Save this as `backup-db.ps1`:

```powershell
$projectPath = "C:\Users\edwar\Claude\Projects\Gamified Plant\seam-assurance-app"
$dbFile = Join-Path $projectPath "dev.db"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $projectPath "dev.db.backup.$timestamp"

if (Test-Path $dbFile) {
    Copy-Item -Path $dbFile -Destination $backupFile
    Write-Host "Backup created: $backupFile" -ForegroundColor Green
    Get-Item $backupFile | Select-Object FullName, Length
} else {
    Write-Host "Database file not found!" -ForegroundColor Red
}
```

Run with:
```bash
powershell -ExecutionPolicy Bypass -File backup-db.ps1
```

---

## Current State (June 25, 2026)

### Database Content
- **Total Controls:** 1,019 records (imported from CSV)
- **Process Areas:** 40+ areas (AIPSM, ESP, MAC, etc.)
- **Sub-Processes:** 200+ sub-processes
- **Activity Types:** Ready for population
- **Assessment Templates:** 0 (system ready, no templates created yet)

### Recent Migrations Applied
1. Initial schema creation (20260621051645_init)
2. Full schema reset to resolve SQLite enum issues (20260625)

### ControlType Values (Current)
- Administrative
- Procedural
- Analytical
- Behavioral
- Informational
- Engineering

### What Changed in Latest Update
- ✅ ControlType enum updated (6 types, was 7 before)
- ✅ All 1,019 controls imported with new type validation
- ✅ Pagination added to Activity Types, Process Areas, Sub-Processes
- ✅ Assessment Templates now use radio buttons (single activity type)
- ✅ Comprehensive design documentation updated

---

## Recovery Procedure

### To Restore from Backup

1. **Stop dev server** (Ctrl+C)

2. **Delete current database:**
   ```bash
   del dev.db
   ```

3. **Restore from backup:**
   ```bash
   copy "dev.db.backup.20260625_final" dev.db
   ```

4. **Regenerate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

## Backup Best Practices

- ✅ Always backup BEFORE major migrations
- ✅ Keep 3-5 rolling backups with dates
- ✅ Store backups in multiple locations (cloud, external drive)
- ✅ Test recovery process periodically
- ✅ Document what's in each backup

---

## Key Files to Backup

| File | Purpose | Size |
|------|---------|------|
| `dev.db` | Main database | ~10-50 MB |
| `prisma/schema.prisma` | Schema definition | ~5 KB |
| `APP_DESIGN.md` | Design documentation | ~30 KB |
| `.env.local` | Environment config | ~200 bytes |

---

## Next Backup Schedule

- **Before major features:** Always backup
- **Weekly:** If in active development
- **After migrations:** Critical - backup immediately
- **Before CSV imports:** Highly recommended

---

**Status:** ✅ Ready for production use  
**Tested:** Yes - 1,019 controls imported and validated  
**Safe to Deploy:** Yes - all migrations clean, no errors
