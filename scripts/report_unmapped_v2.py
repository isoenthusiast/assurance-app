"""Report ALL Unmapped Controls per ProcessArea in SAMS001."""
import psycopg2, os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

# Get all Unmapped Controls in SAMS001 — no JOIN, just count them
cur.execute("""
    SELECT r."rID", r."standard", pa."name" AS pa_name, r."processAreaId"
    FROM "Requirement" r
    JOIN "ProcessArea" pa ON pa."id" = r."processAreaId"
    WHERE r."requirementId" = 'Unmapped Controls' AND r."companyId" = (
        SELECT id FROM "Company" WHERE "companyID" = 'SAMS001'
    )
    ORDER BY r."standard", pa."name"
""")
rows = cur.fetchall()
print(f"Total Unmapped Controls requirements in SAMS001: {len(rows)}")
print()
for r in rows:
    print(f"  rID={r[0]:>5}  PA='{r[2]:<50}'  standard='{r[1][:60]}'")

# Now for EACH ProcessArea, count controls mapped to ITS Unmapped Controls (if any) OR the standard-level one
print("\n--- Per ProcessArea: Unmapped Controls count ---")
cur.execute("""
    SELECT 
        pa."name" AS pa_name,
        pa."id" AS pa_id,
        s."standard",
        COUNT(m."controlId") AS ctrl_count,
        -- Does this PA have its OWN Unmapped Controls?
        CASE WHEN pa_uc."rID" IS NOT NULL THEN 'OWN' ELSE 'SHARED' END AS source
    FROM "ProcessArea" pa
    JOIN "Standard" s ON s."id" = pa."StandardID"
    LEFT JOIN "Requirement" pa_uc ON pa_uc."processAreaId" = pa."id" 
        AND pa_uc."requirementId" = 'Unmapped Controls'
    LEFT JOIN "Requirement" std_uc ON std_uc."standard" = pa."standard"
        AND std_uc."requirementId" = 'Unmapped Controls'
        AND std_uc."companyId" = pa."companyId"
    LEFT JOIN "MapControl2Requirement" m ON m."requirementRId" = COALESCE(pa_uc."rID", std_uc."rID")
    WHERE pa."companyId" = (SELECT id FROM "Company" WHERE "companyID" = 'SAMS001')
    GROUP BY pa."name", pa."id", s."standard", pa_uc."rID"
    ORDER BY s."standard", pa."name"
""", )
rows = cur.fetchall()

grand_total = 0
for pa_name, pa_id, standard, ctrl_count, source in rows:
    if ctrl_count > 0:
        print(f"  {source:<8} {pa_name:<52} {ctrl_count:>4} controls  ({standard[:50]})")
    grand_total += ctrl_count

print(f"\n  Total control mappings across all PAs: {grand_total}")

# How many PAs have their OWN Unmapped Controls vs sharing?
cur.execute("""
    SELECT 
        CASE WHEN pa_uc."rID" IS NOT NULL THEN 'Own UC' ELSE 'Shared UC' END AS type,
        COUNT(*) AS pa_count
    FROM "ProcessArea" pa
    LEFT JOIN "Requirement" pa_uc ON pa_uc."processAreaId" = pa."id" 
        AND pa_uc."requirementId" = 'Unmapped Controls'
    WHERE pa."companyId" = (SELECT id FROM "Company" WHERE "companyID" = 'SAMS001')
    GROUP BY type
""")
print("\n--- Ownership ---")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} PAs")

cur.close()
conn.close()
