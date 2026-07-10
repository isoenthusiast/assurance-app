"""Create DocumentExtract table and import SMDS procedures JSON."""
import os, sys, json
import psycopg2

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

JSON_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'frontline library', '99 SMDS', 'smds_procedures.json')

print("Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    # 1. Create table (drop if exists from prior failed attempt)
    print("1. Creating DocumentExtract table...")
    cur.execute('DROP TABLE IF EXISTS "DocumentExtract" CASCADE')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "DocumentExtract" (
            "id" TEXT PRIMARY KEY,
            "docNo" INTEGER NOT NULL,
            "documentNumber" TEXT,
            "documentType" TEXT,
            "documentTitle" TEXT NOT NULL,
            "custodian" TEXT,
            "authorizer" TEXT,
            "content" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ Table created.")

    # 2. Create indexes
    print("2. Creating indexes...")
    cur.execute('CREATE INDEX IF NOT EXISTS "DocumentExtract_docNo_idx" ON "DocumentExtract"("docNo")')
    cur.execute('CREATE INDEX IF NOT EXISTS "DocumentExtract_documentNumber_idx" ON "DocumentExtract"("documentNumber")')
    print("   ✓ Indexes created.")

    # 3. Load JSON data
    print("3. Loading JSON data...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"   Loaded {len(data)} documents.")

    # 4. Clear existing and insert
    print("4. Inserting documents...")
    cur.execute('DELETE FROM "DocumentExtract"')

    batch_size = 50
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        values = []
        params = []
        for doc in batch:
            doc_id = f"de_{doc['No.']}"
            values.append("(%s, %s, %s, %s, %s, %s, %s, %s)")
            def clean(v):
                if v is None:
                    return None
                return v.replace('\x00', '')

            params.extend([
                doc_id,
                doc['No.'],
                clean(doc.get('Document Number')),
                clean(doc.get('Document Type')),
                clean(doc['Document Title']),
                clean(doc.get('Custodian')),
                clean(doc.get('Authorizer')),
                clean(doc['Content']),
            ])
        cur.execute(
            f'INSERT INTO "DocumentExtract" ("id", "docNo", "documentNumber", "documentType", "documentTitle", "custodian", "authorizer", "content") VALUES {",".join(values)} ON CONFLICT DO NOTHING',
            params
        )

    print(f"   ✓ Inserted {len(data)} documents.")

    # 5. Verify
    cur.execute('SELECT COUNT(*) FROM "DocumentExtract"')
    count = cur.fetchone()[0]
    print(f"\n✅ Migration complete! {count} records in DocumentExtract.")

except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()

import subprocess
print("\nGenerating Prisma client...")
result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result.stdout)
print("✅ Done!")
