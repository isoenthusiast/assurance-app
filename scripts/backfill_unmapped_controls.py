"""Backfill 'Unmapped Controls' requirement for each ProcessArea that lacks one."""
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

# Find PAs without Unmapped Controls, but deduplicate by (standard, companyId)
# because of the @@unique([requirementId, standard, companyId]) constraint
cur.execute('''
    SELECT DISTINCT ON (pa."standard", pa."companyId")
        pa."id", pa."name", pa."companyId", pa."standard", pa."pId"
    FROM "ProcessArea" pa
    WHERE NOT EXISTS (
        SELECT 1 FROM "Requirement" r
        WHERE r."requirementId" = 'Unmapped Controls'
          AND r."standard" = pa."standard"
          AND r."companyId" = pa."companyId"
    )
    ORDER BY pa."standard", pa."companyId", pa."name"
''')
missing = cur.fetchall()
print(f"Standard/Company combos missing 'Unmapped Controls': {len(missing)}")

if missing:
    cur.execute('SELECT COALESCE(MAX("rID"), 0) FROM "Requirement"')
    max_rid = cur.fetchone()[0]
    
    for i, (pa_id, pa_name, co_id, standard, p_id) in enumerate(missing):
        max_rid += 1
        cur.execute('''
            INSERT INTO "Requirement" ("rID", "requirementId", "clauseContent", "intentOutcome",
                "clauseApplicability", "references", "applicable", "standard", "pID", "processAreaId", "companyId", "createdAt")
            VALUES (%s, 'Unmapped Controls', 'Controls not yet mapped to a specific requirement.',
                'These controls need to be reviewed and assigned to the correct requirement.',
                'All controls', '', true, %s, %s, %s, %s, NOW())
            ON CONFLICT DO NOTHING
        ''', (max_rid, standard, p_id, pa_id, co_id))
    
    conn.commit()
    print(f"Created {len(missing)} 'Unmapped Controls' requirements.")

# Verify
cur.execute("SELECT COUNT(*) FROM \"Requirement\" WHERE \"requirementId\" = 'Unmapped Controls'")
total = cur.fetchone()[0]
print(f"Total 'Unmapped Controls' requirements now: {total}")

cur.close()
conn.close()
print("Done.")
