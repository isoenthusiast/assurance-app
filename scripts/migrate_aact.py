"""Create Aact, AActControls, AActUsers, AActDetails tables."""
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
    # 1. Aact table
    print("1. Creating Aact table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "Aact" (
            "id" TEXT PRIMARY KEY,
            "aaID" TEXT NOT NULL UNIQUE,
            "assuranceID" TEXT NOT NULL,
            "assacttypeid" TEXT NOT NULL REFERENCES "AssessmentActType"("assacttypeid"),
            "activityName" TEXT NOT NULL,
            "activityDate" TIMESTAMP(3) NOT NULL,
            "activityStartTime" TEXT NOT NULL,
            "activityEndTime" TEXT NOT NULL,
            "activityDuration" TEXT,
            "activityDescription" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ Aact table created.")

    # 2. AActControls table
    print("2. Creating AActControls table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "AActControls" (
            "id" TEXT PRIMARY KEY,
            "aaId" TEXT NOT NULL REFERENCES "Aact"(id) ON DELETE CASCADE,
            "controlId" TEXT NOT NULL REFERENCES "Control"(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AActControls_aaId_controlId_key" UNIQUE ("aaId", "controlId")
        )
    ''')
    print("   ✓ AActControls table created.")

    # 3. AActUsers table
    print("3. Creating AActUsers table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "AActUsers" (
            "id" TEXT PRIMARY KEY,
            "aaId" TEXT NOT NULL REFERENCES "Aact"(id) ON DELETE CASCADE,
            "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
            "userRoles" TEXT NOT NULL,
            "assignmentRemarks" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AActUsers_aaId_userId_key" UNIQUE ("aaId", "userId")
        )
    ''')
    print("   ✓ AActUsers table created.")

    # 4. AActDetails table
    print("4. Creating AActDetails table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "AActDetails" (
            "id" TEXT PRIMARY KEY,
            "aactDetID" TEXT NOT NULL UNIQUE,
            "aaId" TEXT NOT NULL REFERENCES "Aact"(id) ON DELETE CASCADE,
            "detail" TEXT,
            "summaryAgainstControls" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ AActDetails table created.")

    # 5. Indexes
    print("5. Creating indexes...")
    cur.execute('CREATE INDEX IF NOT EXISTS "AActControls_aaId_idx" ON "AActControls"("aaId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "AActControls_controlId_idx" ON "AActControls"("controlId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "AActUsers_aaId_idx" ON "AActUsers"("aaId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "AActUsers_userId_idx" ON "AActUsers"("userId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "AActDetails_aaId_idx" ON "AActDetails"("aaId")')
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
