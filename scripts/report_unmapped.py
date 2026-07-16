"""Report Unmapped Controls for SAMS001: ProcessArea → Requirement → Controls count."""
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

# Get SAMS001 ID
cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = 'SAMS001'")
sams_id = cur.fetchone()[0]

# For each ProcessArea in SAMS001, find its Unmapped Controls requirement and count mapped controls
cur.execute("""
    SELECT 
        pa."name" AS process_area,
        s."standard",
        r."rID" AS req_rid,
        COUNT(m."controlId") AS control_count
    FROM "ProcessArea" pa
    JOIN "Standard" s ON s."id" = pa."StandardID" AND s."companyId" = %s
    JOIN "Requirement" r ON r."standard" = pa."standard" 
        AND r."requirementId" = 'Unmapped Controls' 
        AND r."companyId" = %s
    LEFT JOIN "MapControl2Requirement" m ON m."requirementRId" = r."rID"
    WHERE pa."companyId" = %s
    GROUP BY pa."name", s."standard", r."rID"
    ORDER BY s."standard", pa."name"
""", (sams_id, sams_id, sams_id))

print(f"{'Process Area':<50} {'Standard':<60} {'Unmapped Controls':>10}")
print("-" * 125)

total_controls = 0
total_pas = 0
for row in cur.fetchall():
    pa_name, standard, req_rid, ctrl_count = row
    print(f"{pa_name:<50} {standard:<60} {ctrl_count:>10}")
    total_controls += ctrl_count
    total_pas += 1

print("-" * 125)
print(f"{'TOTAL':<50} {total_pas} process areas{'':>42} {total_controls:>10}")

# Also show per-standard summary
print("\n--- Per Standard Summary ---")
cur.execute("""
    SELECT 
        s."standard",
        COUNT(DISTINCT pa."id") AS pa_count,
        COUNT(DISTINCT m."controlId") AS unmapped_controls
    FROM "Standard" s
    JOIN "ProcessArea" pa ON pa."standard" = s."standard" AND pa."companyId" = %s
    JOIN "Requirement" r ON r."standard" = s."standard" 
        AND r."requirementId" = 'Unmapped Controls' 
        AND r."companyId" = %s
    LEFT JOIN "MapControl2Requirement" m ON m."requirementRId" = r."rID"
    WHERE s."companyId" = %s
    GROUP BY s."standard"
    ORDER BY s."standard"
""", (sams_id, sams_id, sams_id))

for row in cur.fetchall():
    standard, pa_count, ctrl_count = row
    print(f"  {standard}: {pa_count} PAs, {ctrl_count} unmapped controls")

# Also check: are Unmapped Controls unique per PA or per standard?
print("\n--- Unmapped Controls Requirements ---")
cur.execute("""
    SELECT r."rID", r."standard", pa."name" AS pa_name, r."companyId"
    FROM "Requirement" r
    JOIN "ProcessArea" pa ON pa."id" = r."processAreaId"
    WHERE r."requirementId" = 'Unmapped Controls' AND r."companyId" = %s
    ORDER BY r."standard", pa."name"
""", (sams_id,))
rows = cur.fetchall()
print(f"Total Unmapped Controls requirements in SAMS001: {len(rows)}")
for r in rows:
    print(f"  rID={r[0]}, standard='{r[1]}', PA='{r[2]}'")

cur.close()
conn.close()
