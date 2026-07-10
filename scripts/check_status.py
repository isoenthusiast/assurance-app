import os, psycopg2
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_url = None
for env in ['.env', '.env.local']:
    if os.path.exists(env):
        for line in open(env):
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=',1)[1].strip().strip('"').strip("'")
                break
    if db_url: break

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM \"ControlFromDocument\"")
print(f"Controls: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM \"DocumentExtract\" WHERE \"Status\" = 'Completed'")
print(f"Docs Completed: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM \"DocumentExtract\" WHERE \"Status\" = 'Not Started'")
print(f"Docs Remaining: {cur.fetchone()[0]}")

cur.execute("SELECT \"controlType\", COUNT(*) FROM \"ControlFromDocument\" GROUP BY 1 ORDER BY 2 DESC")
print("\nBy ControlType:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.execute("SELECT COUNT(DISTINCT \"documentExtractId\") FROM \"ControlFromDocument\"")
print(f"\nUnique documents linked: {cur.fetchone()[0]}")

cur.execute("SELECT \"documentExtractId\", \"name\" FROM \"ControlFromDocument\" LIMIT 3")
print("\nSample linkages (docId → control name):")
for row in cur.fetchall():
    print(f"  {row[0][:20]} → {row[1][:80]}")

cur.close()
conn.close()
