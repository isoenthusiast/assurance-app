"""Create UserFavorite table for generic entity favoriting."""
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
    print("1. Creating UserFavorite table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "UserFavorite" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "UserFavorite_userId_entityType_entityId_key" UNIQUE ("userId", "entityType", "entityId")
        )
    ''')
    print("   ✓ UserFavorite table created.")

    print("2. Creating indexes...")
    cur.execute('CREATE INDEX IF NOT EXISTS "UserFavorite_userId_idx" ON "UserFavorite"("userId")')
    cur.execute('CREATE INDEX IF NOT EXISTS "UserFavorite_entityType_idx" ON "UserFavorite"("entityType")')
    cur.execute('CREATE INDEX IF NOT EXISTS "UserFavorite_entityId_idx" ON "UserFavorite"("entityId")')
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
