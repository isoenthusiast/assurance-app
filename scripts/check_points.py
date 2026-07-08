"""Quick check on PointTransaction records."""
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
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM "PointTransaction"')
total = cur.fetchone()[0]
print(f"Total PointTransactions: {total}")

if total > 0:
    print(f"\n{'Pts':>4} | {'User':10} | {'Attribute':25} | {'Reason':22} | Date")
    print("-" * 90)
    cur.execute("""
        SELECT pt."points", u."name", COALESCE(ga."attributeName", '(no attr)'),
               pt."reason", pt."createdAt"::date
        FROM "PointTransaction" pt
        LEFT JOIN "GameAttribute" ga ON ga."id" = pt."gameAttributeId"
        LEFT JOIN "User" u ON u."id" = pt."userId"
        ORDER BY pt."createdAt" DESC
    """)
    for pts, uname, attr, reason, dt in cur.fetchall():
        print(f"{pts:>4} | {uname or '?':10} | {attr:25} | {reason:22} | {dt}")

    # Summary by user
    print(f"\n--- By User ---")
    cur.execute("""
        SELECT u."name", SUM(pt."points"), COUNT(*)
        FROM "PointTransaction" pt
        JOIN "User" u ON u."id" = pt."userId"
        GROUP BY u."name"
        ORDER BY SUM(pt."points") DESC
    """)
    for name, pts, cnt in cur.fetchall():
        print(f"  {name:15} {pts:>5} XP ({cnt} txns)")

    # Summary by attribute
    print(f"\n--- By Attribute ---")
    cur.execute("""
        SELECT COALESCE(ga."attributeName", '(no attr)'), SUM(pt."points"), COUNT(*)
        FROM "PointTransaction" pt
        LEFT JOIN "GameAttribute" ga ON ga."id" = pt."gameAttributeId"
        GROUP BY ga."attributeName"
        ORDER BY SUM(pt."points") DESC
    """)
    for attr, pts, cnt in cur.fetchall():
        print(f"  {attr:25} {pts:>5} XP ({cnt} txns)")
else:
    print("No records found.")

cur.close()
conn.close()
