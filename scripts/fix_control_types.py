"""Fix invalid ControlType values in ControlFromDocument to match Prisma enum."""
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

# Fix Operational -> Procedural
cur.execute("""UPDATE "ControlFromDocument" SET "controlType"='Procedural' WHERE "controlType"='Operational'""")
print(f"Fixed {cur.rowcount} Operational -> Procedural")

# Fix Behavioural -> Behavioral
cur.execute("""UPDATE "ControlFromDocument" SET "controlType"='Behavioral' WHERE "controlType"='Behavioural'""")
print(f"Fixed {cur.rowcount} Behavioural -> Behavioral")

# Also fix in Control table if any
cur.execute("""UPDATE "Control" SET "controlType"='Procedural' WHERE "controlType"='Operational'""")
print(f"Fixed Control: {cur.rowcount} Operational -> Procedural")

cur.close()
conn.close()
print("Done")
