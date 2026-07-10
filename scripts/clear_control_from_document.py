"""Clear ControlFromDocument table and reset DocumentExtract status."""
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
conn.autocommit = True
cur = conn.cursor()

cur.execute('DELETE FROM "ControlFromDocument"')
print(f"Deleted {cur.rowcount} controls from ControlFromDocument")

cur.execute("""UPDATE "DocumentExtract" SET "Status" = 'Not Started', "CompletedOn" = NULL""")
print(f"Reset {cur.rowcount} documents to 'Not Started'")

cur.close()
conn.close()
print("Done — ready for clean re-extraction")
