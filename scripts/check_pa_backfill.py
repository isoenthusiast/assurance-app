"""Quick check: how many ControlFromDocument records have processAreaId populated?"""
import os, sys, psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = None
for env_file in ['.env', '.env.local']:
    env_path = os.path.join(os.getcwd(), env_file)
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    if db_url:
        break

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM \"ControlFromDocument\" WHERE \"processAreaId\" IS NOT NULL AND \"processAreaId\" != ''")
populated = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM \"ControlFromDocument\" WHERE \"processAreaId\" IS NULL OR \"processAreaId\" = ''")
empty = cur.fetchone()[0]

cur.execute("SELECT COUNT(*) FROM \"ControlFromDocument\"")
total = cur.fetchone()[0]

print(f"Populated: {populated}")
print(f"Empty: {empty}")
print(f"Total: {total}")
print(f"Coverage: {populated/total*100:.1f}%")

if populated > 0:
    print("\nTop 15 Process Areas:")
    cur.execute("""
        SELECT pa.name, COUNT(*) as cnt
        FROM "ControlFromDocument" cfd
        JOIN "ProcessArea" pa ON pa.id = cfd."processAreaId"
        GROUP BY pa.name
        ORDER BY cnt DESC
        LIMIT 15
    """)
    for row in cur.fetchall():
        print(f"  {row[0][:50]:50s} {row[1]:5d}")

    print("\nSample matches:")
    cur.execute("""
        SELECT cfd.name, pa.name as pa_name
        FROM "ControlFromDocument" cfd
        JOIN "ProcessArea" pa ON pa.id = cfd."processAreaId"
        WHERE pa.name != 'Uncategorized'
        ORDER BY RANDOM()
        LIMIT 10
    """)
    for row in cur.fetchall():
        print(f"  {row[0][:65]:65s} → {row[1]}")

cur.close()
conn.close()
