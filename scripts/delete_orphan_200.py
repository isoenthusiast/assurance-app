"""Delete the orphan 200-pt PointTransaction and fix Admin totalPoints."""
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

# Find the orphan row
cur.execute("""
    SELECT pt."id", pt."points", pt."userId", u."name", u."totalPoints"
    FROM "PointTransaction" pt
    JOIN "User" u ON u."id" = pt."userId"
    WHERE pt."points" = 200 AND pt."gameAttributeId" IS NULL
""")
rows = cur.fetchall()

if not rows:
    print("No orphan 200-pt record found.")
else:
    for row in rows:
        txn_id, pts, uid, uname, current_total = row
        print(f"Deleting: {pts} XP | {uname} | txn_id={txn_id}")
        cur.execute('DELETE FROM "PointTransaction" WHERE "id" = %s', (txn_id,))
        # Fix User.totalPoints: subtract 200
        new_total = current_total - pts
        cur.execute('UPDATE "User" SET "totalPoints" = %s WHERE "id" = %s', (new_total, uid))
        print(f"  Updated {uname}.totalPoints: {current_total} → {new_total}")

cur.close()
conn.close()
print("\n✅ Done.")
