"""Add beforeData and afterData JSON columns to ActivityLog."""
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
conn.autocommit = True
cur = conn.cursor()

cur.execute('ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "beforeData" JSONB')
print("✓ beforeData column ready.")
cur.execute('ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "afterData" JSONB')
print("✓ afterData column ready.")

cur.close()
conn.close()
print("✅ Done.")
