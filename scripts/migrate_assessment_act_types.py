"""Create AssessmentActType table and seed initial types."""
import os, sys
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

print("Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

try:
    print("1. Creating AssessmentActType table...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS "AssessmentActType" (
            "id" TEXT PRIMARY KEY,
            "assacttypeid" TEXT NOT NULL UNIQUE,
            "assacttypeName" TEXT NOT NULL UNIQUE,
            "description" TEXT,
            "createddate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("   ✓ Table created.")

    # Seed the 3 activity types
    seed_types = [
        ("ACT-001", "Interview", "Interview-based assessment activity"),
        ("ACT-002", "DocumentReview", "Document review assessment activity"),
        ("ACT-003", "Site Visit", "On-site inspection assessment activity"),
    ]
    print("2. Seeding activity types...")
    for act_id, act_name, act_desc in seed_types:
        cur.execute('''
            INSERT INTO "AssessmentActType" ("id", "assacttypeid", "assacttypeName", "description")
            VALUES (%s, %s, %s, %s)
            ON CONFLICT ("assacttypeid") DO UPDATE SET
                "assacttypeName" = EXCLUDED."assacttypeName",
                "description" = EXCLUDED."description"
        ''', (f"act_{act_id}", act_id, act_name, act_desc))
        print(f"   ✓ {act_name} ({act_id})")

    print("\n✅ Migration complete!")
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()

# Regenerate Prisma client
import subprocess
print("\nGenerating Prisma client...")
result = subprocess.run(
    ["node", "node_modules/prisma/build/index.js", "generate"],
    capture_output=True, text=True, timeout=30
)
print(result.stdout)
print("✅ Done!")
