"""Drop old UserRole table and push new schema."""
import subprocess, sys, os

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Read DATABASE_URL (same pattern as other scripts)
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

import psycopg2

print(f"Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    # 1. Add position and companyId to User table
    print("1. Adding position and companyId to User...")
    cur.execute('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" TEXT')
    cur.execute('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyId" TEXT')
    print("   ✓ Columns added to User.")

    # 2. Drop old UserRole and UserRoleMapping tables
    print("2. Dropping old tables...")
    cur.execute('DROP TABLE IF EXISTS "UserRoleMapping" CASCADE')
    cur.execute('DROP TABLE IF EXISTS "UserRole" CASCADE')
    print("   ✓ Old tables dropped.")

    # 3. Create new UserRole table
    print("3. Creating new UserRole table...")
    cur.execute('''
        CREATE TABLE "UserRole" (
            "id" TEXT PRIMARY KEY,
            "uRoleName" TEXT NOT NULL UNIQUE,
            "uRoleDescription" TEXT,
            "uRolePositions" TEXT,
            "uRoleReportingLine" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ New UserRole table created.")

    # 4. Create UserRoleMapping table
    print("4. Creating UserRoleMapping table...")
    cur.execute('''
        CREATE TABLE "UserRoleMapping" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
            "userRoleId" TEXT NOT NULL REFERENCES "UserRole"(id) ON DELETE CASCADE,
            "remarks" TEXT,
            "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "UserRoleMapping_userId_userRoleId_key" UNIQUE ("userId", "userRoleId")
        )
    ''')
    print("   ✓ UserRoleMapping table created.")

    # 5. Create indexes
    print("5. Creating indexes...")
    cur.execute('CREATE INDEX IF NOT EXISTS "UserRoleMapping_userId_idx" ON "UserRoleMapping"("userId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "UserRoleMapping_userRoleId_idx" ON "UserRoleMapping"("userRoleId")')
    print("   ✓ Indexes created.")

    print("\n✅ Migration complete!")

except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()

# Regenerate prisma client
print("\nGenerating Prisma client...")
result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
print("✅ Done!")
