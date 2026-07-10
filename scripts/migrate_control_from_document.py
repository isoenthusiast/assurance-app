"""Create ControlFromDocument table mirroring Control + DocumentExtract FK."""
import os, sys
import psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not db_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

print("Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    print("1. Creating ControlFromDocument table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "ControlFromDocument" (
            "id" TEXT PRIMARY KEY,
            "documentExtractId" TEXT NOT NULL REFERENCES "DocumentExtract"(id) ON DELETE CASCADE,
            "name" TEXT NOT NULL,
            "statement" TEXT NOT NULL DEFAULT '',
            "controlType" TEXT NOT NULL DEFAULT 'Administrative',
            "processAreaId" TEXT NOT NULL DEFAULT '',
            "isHsseCritical" BOOLEAN NOT NULL DEFAULT false,
            "ramRating" TEXT,
            "riskWeight" INTEGER NOT NULL DEFAULT 1,
            "rawHealthScore" INTEGER NOT NULL DEFAULT 80,
            "lastTestedDate" TIMESTAMP(3),
            "lastTestResult" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "controlRef" TEXT,
            "sourceFile" TEXT,
            "practiceDocument" TEXT,
            "controlTypeDetail" TEXT,
            "csfWho" TEXT,
            "csfWhat" TEXT,
            "csfWhen" TEXT,
            "csfWhere" TEXT,
            "csfWhy" TEXT,
            "csfHow" TEXT,
            "csfEvidence" TEXT,
            "keyActivities" TEXT,
            "riskAddressed" TEXT,
            "testingApproach" TEXT,
            "uncertainFlags" TEXT,
            "standard" TEXT,
            "pId" TEXT,
            "Requirements" TEXT
        )
    ''')
    print("   ✓ Table created.")

    print("2. Creating indexes...")
    cur.execute('CREATE INDEX IF NOT EXISTS "ControlFromDocument_documentExtractId_idx" ON "ControlFromDocument"("documentExtractId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "ControlFromDocument_controlRef_idx" ON "ControlFromDocument"("controlRef")')
    print("   ✓ Indexes created.")

    print("\n✅ Migration complete!")
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()

import subprocess
print("\nGenerating Prisma client...")
result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result.stdout)
print("✅ Done!")
