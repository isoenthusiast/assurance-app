"""Add Status and CompletedOn columns to DocumentExtract table."""
import os, sys, psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not db_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("""ALTER TABLE "DocumentExtract" ADD COLUMN "Status" TEXT NOT NULL DEFAULT 'Not Started'""")
    print("Added Status column")
except Exception as e:
    if "already exists" in str(e):
        print("Status column already exists")
    else:
        print(f"Status column error: {e}")

try:
    cur.execute("""ALTER TABLE "DocumentExtract" ADD COLUMN "CompletedOn" TIMESTAMP(3)""")
    print("Added CompletedOn column")
except Exception as e:
    if "already exists" in str(e):
        print("CompletedOn column already exists")
    else:
        print(f"CompletedOn column error: {e}")

try:
    cur.execute("""CREATE INDEX IF NOT EXISTS "DocumentExtract_Status_idx" ON "DocumentExtract"("Status")""")
    print("Created Status index")
except Exception as e:
    print(f"Status index error: {e}")

cur.close()
conn.close()
print("Done")
