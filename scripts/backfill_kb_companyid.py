"""Backfill Knowledgebase companyId: map existing records to SAMS001."""
import psycopg2
import os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM "Knowledgebase" WHERE "companyId" IS NULL')
null_count = cur.fetchone()[0]
print(f"Records with NULL companyId: {null_count}")

if null_count > 0:
    cur.execute('UPDATE "Knowledgebase" SET "companyId" = \'SAMS001\' WHERE "companyId" IS NULL')
    conn.commit()
    print(f"Updated {cur.rowcount} records to companyId=SAMS001")

cur.execute('SELECT "companyId", COUNT(*) FROM "Knowledgebase" GROUP BY "companyId"')
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} records")

cur.close()
conn.close()
print("Done.")
