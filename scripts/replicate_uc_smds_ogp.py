"""Replicate SAMS Unmapped Controls pattern to SMDS and OGP.
For each PA: create Unmapped Controls requirement + map controls via SubProcess chain."""
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

for target_cid in ['SMDS', 'OGP']:
    cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = %s", (target_cid,))
    row = cur.fetchone()
    if not row:
        print(f"{target_cid}: not found, skipping.")
        continue
    co_id = row[0]

    # 1. Create missing Unmapped Controls per PA
    cur.execute("SELECT COALESCE(MAX(\"rID\"), 0) FROM \"Requirement\"")
    max_rid = cur.fetchone()[0]

    cur.execute("""
        SELECT pa."id", pa."name", pa."standard", pa."pId"
        FROM "ProcessArea" pa
        WHERE pa."companyId" = %s
          AND NOT EXISTS (
            SELECT 1 FROM "Requirement" r
            WHERE r."processAreaId" = pa."id"
              AND r."requirementId" = 'Unmapped Controls'
          )
    """, (co_id,))
    missing = cur.fetchall()
    created = 0
    for pa_id, pa_name, std, pId in missing:
        max_rid += 1
        try:
            cur.execute("""
                INSERT INTO "Requirement" ("rID", "requirementId", "clauseContent", "intentOutcome",
                    "clauseApplicability", "references", "applicable", "standard", "pID",
                    "processAreaId", "companyId", "createdAt")
                VALUES (%s, 'Unmapped Controls', 'Controls not yet mapped to a specific requirement.',
                    'Review and assign to the correct requirement.',
                    'All controls', '', true, %s, %s, %s, %s, NOW())
            """, (max_rid, std, pId, pa_id, co_id))
            created += 1
        except Exception as e:
            print(f"  Failed {pa_name}: {e}")
            conn.rollback()
    conn.commit()

    # 2. Clear old Unmapped Controls mappings for this company
    cur.execute("""
        DELETE FROM "MapControl2Requirement" m
        USING "Requirement" r
        WHERE m."requirementRId" = r."rID"
          AND r."requirementId" = 'Unmapped Controls'
          AND r."companyId" = %s
    """, (co_id,))
    deleted = cur.rowcount

    # 3. Re-map controls to their PA's Unmapped Controls via SubProcess chain
    cur.execute("""
        INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId")
        SELECT DISTINCT
            'm2r_' || c."id" || '_' || uc."rID",
            c."id",
            uc."rID",
            pa."id"
        FROM "Control" c
        JOIN "ControlSubProcess" csp ON csp."controlId" = c."id"
        JOIN "SubProcess" sp ON sp."id" = csp."subProcessId"
        JOIN "ProcessArea" pa ON pa."id" = sp."processAreaId" AND pa."companyId" = c."companyId"
        JOIN "Requirement" uc ON uc."processAreaId" = pa."id"
            AND uc."requirementId" = 'Unmapped Controls'
            AND uc."companyId" = c."companyId"
        WHERE c."companyId" = %s
        ON CONFLICT DO NOTHING
    """, (co_id,))
    mapped = cur.rowcount
    conn.commit()

    print(f"{target_cid}: created {created} UCs, cleared {deleted}, mapped {mapped}")

cur.close()
conn.close()
print("Done.")
