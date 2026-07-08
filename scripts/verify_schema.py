"""Compare AchievementBadge DB columns vs Prisma schema."""
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

if not db_url: print("ERROR"); sys.exit(1)

url = db_url.replace('postgresql://', '')
auth_host, dbname = url.rsplit('/', 1)
auth, hostport = auth_host.rsplit('@', 1)
user, password = auth.split(':', 1)
host, port = (hostport.split(':', 1) + ['5432'])[:2]

import psycopg2
conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
cur = conn.cursor()

# Get actual DB columns
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'AchievementBadge'
    ORDER BY ordinal_position
""")
print("=== AchievementBadge — Actual DB Columns ===")
db_cols = set()
for name, dtype, nullable in cur.fetchall():
    db_cols.add(name)
    print(f"  {name:20} {dtype:15} nullable={nullable}")

# Get Prisma schema columns (expected)
print("\n=== Prisma Schema Columns ===")
schema_cols = [
    "id", "badgeName", "description", "icon", "badgeImage",
    "emotionalDrive", "rarity", "level", "processAreaId",
    "pointsRequired", "controlsChecked", "streakDays",
    "achievementType", "createdAt"
]
for c in schema_cols:
    status = "✓" if c in db_cols else "✗ MISSING"
    print(f"  {c:20} {status}")

# Show columns in DB but not in schema
missing_in_schema = db_cols - set(schema_cols)
if missing_in_schema:
    print(f"\n=== DB columns NOT in schema: {missing_in_schema} ===")

# Also check other key tables
for table in ["GameAttribute", "GameAttributeRule", "PointTransaction", "ActivityLog"]:
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    cols = cur.fetchall()
    print(f"\n=== {table} ({len(cols)} cols) ===")
    for name, dtype in cols:
        print(f"  {name:25} {dtype}")

cur.close()
conn.close()
