"""Add companyId column to Knowledgebase table."""
import psycopg2
import os

# Load DATABASE_URL from .env file
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

# Add column
cur.execute('ALTER TABLE "Knowledgebase" ADD COLUMN IF NOT EXISTS "companyId" TEXT')
print("Added companyId column to Knowledgebase")

# Add unique index (may fail if duplicate NULL knowledgeName rows exist)
try:
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Knowledgebase_knowledgeName_companyId_key" ON "Knowledgebase"("knowledgeName", "companyId")')
    print("Created unique index: Knowledgebase(knowledgeName, companyId)")
except Exception as e:
    print(f"Unique index skipped: {e}")

# Add companyId index
cur.execute('CREATE INDEX IF NOT EXISTS "Knowledgebase_companyId_idx" ON "Knowledgebase"("companyId")')
print("Created index: Knowledgebase(companyId)")

conn.commit()

# Verify
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='Knowledgebase' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print(f"Knowledgebase columns: {cols}")
print("companyId exists:", 'companyId' in cols)

cur.close()
conn.close()
print("Done.")
