"""Remove duplicate Unmapped Controls mappings: controls already mapped to another requirement in the same PA."""
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

for target_cid in ['SAMS001', 'SMDS', 'OGP']:
    cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = %s", (target_cid,))
    row = cur.fetchone()
    if not row: continue
    co_id = row[0]

    # Count before
    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT m_uc."id"
            FROM "MapControl2Requirement" m_uc
            JOIN "Requirement" uc_req ON uc_req."rID" = m_uc."requirementRId"
                AND uc_req."requirementId" = 'Unmapped Controls'
                AND uc_req."companyId" = %s
            JOIN "MapControl2Requirement" m_other ON m_other."controlId" = m_uc."controlId"
                AND m_other."requirementRId" != m_uc."requirementRId"
            JOIN "Requirement" other_req ON other_req."rID" = m_other."requirementRId"
                AND other_req."processAreaId" = uc_req."processAreaId"
                AND other_req."requirementId" != 'Unmapped Controls'
                AND other_req."companyId" = %s
        ) t
    """, (co_id, co_id))
    before = cur.fetchone()[0]

    if before == 0:
        print(f"{target_cid}: ✅ No duplicates to remove")
        continue

    # Delete duplicates
    cur.execute("""
        DELETE FROM "MapControl2Requirement" m_uc
        USING "Requirement" uc_req, "MapControl2Requirement" m_other, "Requirement" other_req
        WHERE uc_req."rID" = m_uc."requirementRId"
            AND uc_req."requirementId" = 'Unmapped Controls'
            AND uc_req."companyId" = %s
            AND m_other."controlId" = m_uc."controlId"
            AND m_other."requirementRId" != m_uc."requirementRId"
            AND other_req."rID" = m_other."requirementRId"
            AND other_req."processAreaId" = uc_req."processAreaId"
            AND other_req."requirementId" != 'Unmapped Controls'
            AND other_req."companyId" = %s
    """, (co_id, co_id))
    deleted = cur.rowcount
    conn.commit()
    print(f"{target_cid}: Removed {deleted} duplicate Unmapped Controls mappings (had {before})")

cur.close()
conn.close()
print("Done.")
