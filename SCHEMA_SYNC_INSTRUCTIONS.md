# Schema Sync Instructions

## Problem
`npx prisma db push --accept-data-loss` fails with:
```
Error: P2002
Unique constraint failed on the fields: (`id`)
```
This is a Prisma engine bug when tracking schema state in `_prisma_migrations`.

## Solution: Direct SQL via Python

### Prerequisites
```powershell
# Install psycopg2 for the system Python (one-time)
C:/Users/edwar/AppData/Local/Microsoft/WindowsApps/python3.13.exe -m pip install psycopg2-binary
```

### Step 1: Write the SQL changes in `scripts/sync-schema.sql`
Example:
```sql
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "actionTaken" TEXT;

CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT PRIMARY KEY,
  "description" TEXT,
  "fileName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "uploadedBy" TEXT NOT NULL,
  "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AttachmentMapping" (
  "id" TEXT PRIMARY KEY,
  "attachmentId" TEXT NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
  "destTable" TEXT NOT NULL,
  "recId" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "AttachmentMapping_destTable_recId_idx" 
  ON "AttachmentMapping" ("destTable", "recId");
CREATE INDEX IF NOT EXISTS "AttachmentMapping_attachmentId_idx" 
  ON "AttachmentMapping" ("attachmentId");
```

### Step 2: Run via Python script
The script at `scripts/sync_schema.py` reads `DATABASE_URL` from `.env`, connects via psycopg2, and executes the SQL with `IF NOT EXISTS` guards (idempotent — safe to re-run).

```powershell
cd seam-assurance-app
C:/Users/edwar/AppData/Local/Microsoft/WindowsApps/python3.13.exe scripts/sync_schema.py
```

Or use the VS Code task: **Terminal → Run Task → Sync Schema SQL**

### Step 3: Regenerate Prisma Client
```powershell
cd seam-assurance-app
node node_modules/prisma/build/index.js generate
```

### Step 4: Restart Dev Server
```powershell
# Kill old server
taskkill /PID <PID> /F

# Start new server
cd seam-assurance-app
node node_modules/next/dist/bin/next dev
```

Or use VS Code tasks: **Kill old dev** then **Run dev via node**

## When Adding New Models/Fields

1. Add the model/field to `prisma/schema.prisma`
2. Add the corresponding `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ADD COLUMN IF NOT EXISTS` to `scripts/sync-schema.sql`
3. Update `scripts/sync_schema.py` if needed (add new try/except blocks following the existing pattern)
4. Run the **Sync Schema SQL** task
5. Run `prisma generate` to update the TypeScript client
6. Restart the dev server

## DATABASE_URL
The connection string is in `seam-assurance-app/.env`:
```
DATABASE_URL="postgresql://postgres:<password>@hayabusa.proxy.rlwy.net:54471/railway"
```
