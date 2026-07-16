"""Add processAreaId column to Knowledgebase table."""
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

cur.execute('ALTER TABLE "Knowledgebase" ADD COLUMN IF NOT EXISTS "processAreaId" TEXT')
print("Added processAreaId column to Knowledgebase")

cur.execute('CREATE INDEX IF NOT EXISTS "Knowledgebase_processAreaId_idx" ON "Knowledgebase"("processAreaId")')
print("Created index: Knowledgebase(processAreaId)")

conn.commit()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='Knowledgebase' ORDER BY ordinal_position")
print("Knowledgebase columns:", [r[0] for r in cur.fetchall()])
cur.close()
conn.close()
print("Done.")
