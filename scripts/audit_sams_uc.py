"""Audit: every SAMS001 ProcessArea has its own Unmapped Controls requirement."""
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

cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = 'SAMS001'")
sams = cur.fetchone()[0]

cur.execute("""
    SELECT pa."name", pa."standard",
           CASE WHEN uc."rID" IS NOT NULL THEN '✓' ELSE '✗ MISSING' END AS status,
           COUNT(DISTINCT m."controlId") AS ctrl_count
    FROM "ProcessArea" pa
    LEFT JOIN "Requirement" uc ON uc."processAreaId" = pa."id" 
        AND uc."requirementId" = 'Unmapped Controls'
    LEFT JOIN "MapControl2Requirement" m ON m."requirementRId" = uc."rID"
    WHERE pa."companyId" = %s
    GROUP BY pa."name", pa."standard", uc."rID"
    ORDER BY status DESC, pa."standard", pa."name"
""", (sams,))

rows = cur.fetchall()
missing = [r for r in rows if r[2] != '✓']
total = len(rows)

print(f"SAMS001: {total} process areas")
print(f"With Unmapped Controls: {total - len(missing)}")
print(f"Missing: {len(missing)}")
print()

if missing:
    for name, std, status, ctrl_count in missing:
        print(f"  {status}  {name:<50} ({std[:40]})")
else:
    print("✅ Every SAMS001 process area has its own Unmapped Controls.")

# Quick summary of control counts
print(f"\nControl mapping summary:")
zero_ctrl = [r for r in rows if r[3] == 0 and r[2] == '✓']
if zero_ctrl:
    print(f"  {len(zero_ctrl)} PAs have Unmapped Controls with 0 controls mapped")
for name, std, status, ctrl_count in rows:
    if ctrl_count > 0:
        print(f"  {ctrl_count:>4} controls → {name}")

cur.close()
conn.close()
