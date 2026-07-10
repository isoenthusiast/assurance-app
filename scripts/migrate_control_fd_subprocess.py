"""Create ControlFDSubProcess junction table."""
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

cur.execute('''
    CREATE TABLE IF NOT EXISTS "ControlFDSubProcess" (
        "id" TEXT PRIMARY KEY,
        "controlFromDocumentId" TEXT NOT NULL,
        "subProcessId" TEXT NOT NULL,
        "isPrimary" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
''')
print("✓ ControlFDSubProcess table created")

# Add unique constraint
try:
    cur.execute('ALTER TABLE "ControlFDSubProcess" ADD CONSTRAINT "ControlFDSubProcess_unique" UNIQUE ("controlFromDocumentId", "subProcessId")')
    print("✓ Unique constraint added")
except Exception as e:
    if 'already exists' in str(e):
        print("  Unique constraint already exists")
    else:
        print(f"  Unique constraint: {e}")

# Add foreign keys
try:
    cur.execute('ALTER TABLE "ControlFDSubProcess" ADD CONSTRAINT "ControlFDSubProcess_cfdId_fkey" FOREIGN KEY ("controlFromDocumentId") REFERENCES "ControlFromDocument"(id) ON DELETE CASCADE')
    print("✓ FK → ControlFromDocument added")
except Exception as e:
    if 'already exists' in str(e):
        print("  FK already exists")
    else:
        print(f"  FK error: {e}")

try:
    cur.execute('ALTER TABLE "ControlFDSubProcess" ADD CONSTRAINT "ControlFDSubProcess_spId_fkey" FOREIGN KEY ("subProcessId") REFERENCES "SubProcess"(id) ON DELETE CASCADE')
    print("✓ FK → SubProcess added")
except Exception as e:
    if 'already exists' in str(e):
        print("  FK already exists")
    else:
        print(f"  FK error: {e}")

cur.execute('CREATE INDEX IF NOT EXISTS "ControlFDSubProcess_controlFromDocumentId_idx" ON "ControlFDSubProcess"("controlFromDocumentId")')
cur.execute('CREATE INDEX IF NOT EXISTS "ControlFDSubProcess_subProcessId_idx" ON "ControlFDSubProcess"("subProcessId")')
print("✓ Indexes created")

cur.close()
conn.close()

import subprocess
print("\nRegenerating Prisma client...")
result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result.stdout)
if result.returncode != 0:
    print(result.stderr)
print("✅ Done!")
