"""Add GameAttribute table and gameAttributeId to PointTransaction."""
import os, sys

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
db_url = os.environ.get('DATABASE_URL')
if not db_url and os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break

if not db_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

url = db_url.replace('postgresql://', '')
auth_host, dbname = url.rsplit('/', 1)
auth, hostport = auth_host.rsplit('@', 1)
user, password = auth.split(':', 1)
host, port = (hostport.split(':', 1) + ['5432'])[:2]

import psycopg2
conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
conn.autocommit = True
cur = conn.cursor()

# 1. Create GameAttribute table
print("1. Creating GameAttribute table...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS "GameAttribute" (
        "id" TEXT PRIMARY KEY,
        "attributeName" TEXT NOT NULL UNIQUE,
        "attributeDescription" TEXT,
        "attributeStatus" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("   ✓ GameAttribute table ready.")

# 2. Add gameAttributeId column to PointTransaction
print("2. Adding gameAttributeId to PointTransaction...")
cur.execute('ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "gameAttributeId" TEXT')
print("   ✓ gameAttributeId column ready.")

# 3. Add foreign key constraint (if not exists)
print("3. Adding foreign key constraint...")
try:
    cur.execute('ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_gameAttributeId_fkey" FOREIGN KEY ("gameAttributeId") REFERENCES "GameAttribute"("id") ON DELETE SET NULL ON UPDATE CASCADE')
    print("   ✓ FK constraint added.")
except Exception as e:
    if 'already exists' in str(e) or 'duplicate' in str(e):
        print("   - FK constraint already exists.")
    else:
        print(f"   ⚠ {e}")

# 4. Create index
print("4. Creating index on gameAttributeId...")
cur.execute('CREATE INDEX IF NOT EXISTS "PointTransaction_gameAttributeId_idx" ON "PointTransaction" ("gameAttributeId")')
print("   ✓ Index ready.")

# 5. Seed default game attributes
print("5. Seeding default game attributes...")
defaults = [
    ("Conduct Assurance", "XP earned for conducting assurance activities and testing controls"),
    ("Evidence Documentation", "XP earned for documenting evidence and findings"),
    ("Plan Assessment", "XP earned for planning and scheduling assessments"),
    ("Complete Assessment", "XP earned for completing an assessment"),
    ("HSSE Critical", "Bonus XP for testing HSSE-critical controls"),
    ("Quality Excellence", "Bonus XP for high-quality work (quality score > 80)"),
    ("Team Collaboration", "XP earned for team engagement and collaboration"),
    ("Milestone Achievement", "XP earned for reaching gamification milestones"),
]
for name, desc in defaults:
    try:
        cur.execute(
            'INSERT INTO "GameAttribute" ("id", "attributeName", "attributeDescription") VALUES (gen_random_uuid()::text, %s, %s) ON CONFLICT ("attributeName") DO NOTHING',
            (name, desc)
        )
    except Exception as e:
        print(f"   ⚠ {name}: {e}")
print("   ✓ Default attributes seeded.")

cur.close()
conn.close()
print("\n✅ GameAttribute migration complete!")
