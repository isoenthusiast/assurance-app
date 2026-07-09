"""Migrate Control.subProcessId → ControlSubProcess bridge table."""
import os, sys, uuid
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
db_url = os.environ.get('DATABASE_URL')
if not db_url and os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
if not db_url: print("ERROR"); sys.exit(1)
url = db_url.replace('postgresql://', '')
ah, db = url.rsplit('/', 1)
a, hp = ah.rsplit('@', 1)
u, p = a.split(':', 1)
h, pt = (hp.split(':', 1) + ['5432'])[:2]
import psycopg2
c = psycopg2.connect(host=h, port=pt, user=u, password=p, dbname=db)
c.autocommit = True
cur = c.cursor()

# 1. Make subProcessId nullable
print("1. Making subProcessId nullable...")
cur.execute('ALTER TABLE "Control" ALTER COLUMN "subProcessId" DROP NOT NULL')
print("   ✓ Done.")

# 2. Migrate existing links to ControlSubProcess bridge
print("2. Migrating existing subProcessId → ControlSubProcess...")
cur.execute("""
    INSERT INTO "ControlSubProcess" ("id", "controlId", "subProcessId", "createdAt")
    SELECT gen_random_uuid()::text, c."id", c."subProcessId", NOW()
    FROM "Control" c
    WHERE c."subProcessId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "ControlSubProcess" cs
        WHERE cs."controlId" = c."id" AND cs."subProcessId" = c."subProcessId"
      )
""")
count = cur.rowcount
print(f"   ✓ Migrated {count} records.")

# 3. Verify
cur.execute('SELECT COUNT(*) FROM "ControlSubProcess"')
total = cur.fetchone()[0]
cur.execute('SELECT COUNT(*) FROM "Control" WHERE "subProcessId" IS NOT NULL')
with_sp = cur.fetchone()[0]
print(f"\n✅ ControlSubProcess: {total} bridge records")
print(f"   Controls with subProcessId: {with_sp}")

cur.close()
c.close()
