"""Add GameAttributeRule table, activityLogId to PointTransaction, seed default rules."""
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

# 1. Add activityLogId to PointTransaction
print("1. Adding activityLogId to PointTransaction...")
cur.execute('ALTER TABLE "PointTransaction" ADD COLUMN IF NOT EXISTS "activityLogId" TEXT')
print("   ✓ Column added.")

# 2. Create GameAttributeRule table
print("2. Creating GameAttributeRule table...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS "GameAttributeRule" (
        "id" TEXT PRIMARY KEY,
        "gameAttributeId" TEXT NOT NULL REFERENCES "GameAttribute"("id") ON DELETE CASCADE,
        "activityType" TEXT NOT NULL,
        "basePoints" INTEGER NOT NULL DEFAULT 0,
        "perControlPoints" INTEGER NOT NULL DEFAULT 0,
        "hsseBonusPoints" INTEGER NOT NULL DEFAULT 0,
        "qualityThreshold" DOUBLE PRECISION,
        "qualityBonus" INTEGER NOT NULL DEFAULT 0,
        "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("   ✓ Table created.")

# 3. Add unique constraint and indexes
print("3. Adding constraints & indexes...")
try:
    cur.execute('ALTER TABLE "GameAttributeRule" ADD CONSTRAINT "GameAttributeRule_gameAttributeId_activityType_key" UNIQUE ("gameAttributeId", "activityType")')
    print("   - Unique constraint added.")
except Exception as e:
    if 'already exists' in str(e):
        print("   - Unique constraint already exists.")
    else:
        print(f"   ⚠ {e}")

for idx in ["gameAttributeId", "activityType"]:
    try:
        cur.execute(f'CREATE INDEX IF NOT EXISTS "GameAttributeRule_{idx}_idx" ON "GameAttributeRule" ("{idx}")')
        print(f"   - Index on {idx} ready.")
    except Exception as e:
        print(f"   ⚠ {idx}: {e}")

# 4. Add FK from PointTransaction to ActivityLog
print("4. Adding PointTransaction→ActivityLog FK...")
try:
    cur.execute('ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_activityLogId_fkey" FOREIGN KEY ("activityLogId") REFERENCES "ActivityLog"("id") ON DELETE SET NULL')
    print("   ✓ FK added.")
except Exception as e:
    if 'already exists' in str(e):
        print("   - FK already exists.")
    else:
        print(f"   ⚠ {e}")

try:
    cur.execute('CREATE INDEX IF NOT EXISTS "PointTransaction_activityLogId_idx" ON "PointTransaction" ("activityLogId")')
    print("   - activityLogId index ready.")
except Exception as e:
    print(f"   ⚠ {e}")

# 5. Seed default point-awarding rules
print("\n5. Seeding default rules...")

# Helper: get attribute ID by name
def get_attr_id(name):
    cur.execute('SELECT "id" FROM "GameAttribute" WHERE "attributeName" = %s', (name,))
    row = cur.fetchone()
    return row[0] if row else None

rules = [
    # Conduct Assurance — triggered when an FLA assessment is completed
    # 5 base pts + 1 pt per associated control
    ("Conduct Assurance", "Complete Assessment", 5, 1, 0, None, 0, 1.0,
     "5 XP base + 1 XP per control when an FLA assessment is completed"),
    # HSSE Critical bonus
    ("HSSE Critical", "Complete Assessment", 0, 0, 3, None, 0, 1.0,
     "3 bonus XP for each HSSE-critical control in a completed assessment"),
    # Quality Excellence bonus
    ("Quality Excellence", "Complete Assessment", 0, 0, 0, 85.0, 5, 1.0,
     "5 bonus XP when assessment quality score >= 85%"),
    # Conduct Assurance — per control tested
    ("Conduct Assurance", "Control Tested", 2, 0, 0, None, 0, 1.0,
     "2 XP per control tested"),
    # Evidence Documentation
    ("Evidence Documentation", "Evidence Documented", 3, 0, 0, None, 0, 1.0,
     "3 XP per evidence record documented"),
    # Plan Assessment
    ("Plan Assessment", "FLA Planned", 4, 0, 0, None, 0, 1.0,
     "4 XP per FLA assessment planned"),
    # Milestone Achievement
    ("Milestone Achievement", "Milestone Reached", 10, 0, 0, None, 0, 1.0,
     "10 XP per milestone achieved"),
    # Team Collaboration
    ("Team Collaboration", "Team Activity", 3, 0, 0, None, 0, 1.0,
     "3 XP per team collaboration event"),
]

for attr_name, activity_type, base, per_ctrl, hsse, q_thresh, q_bonus, mult, desc in rules:
    attr_id = get_attr_id(attr_name)
    if not attr_id:
        print(f"   ⚠ Skipping '{attr_name}' — attribute not found in GameAttribute table")
        continue
    try:
        cur.execute("""
            INSERT INTO "GameAttributeRule" ("id", "gameAttributeId", "activityType", "basePoints", "perControlPoints", "hsseBonusPoints", "qualityThreshold", "qualityBonus", "multiplier", "description")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ("gameAttributeId", "activityType") DO NOTHING
        """, (attr_id, activity_type, base, per_ctrl, hsse, q_thresh, q_bonus, mult, desc))
        print(f"   ✓ {attr_name} / {activity_type}: {base}+{per_ctrl}/ctrl pts")
    except Exception as e:
        print(f"   ⚠ {attr_name}: {e}")

cur.close()
conn.close()
print("\n✅ GameAttributeRule migration complete!")
