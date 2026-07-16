"""Report: controls mapped to BOTH Unmapped Controls and another requirement in the same PA."""
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

    # Count duplicates first
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
    dup_count = cur.fetchone()[0]

    if dup_count == 0:
        print(f"{target_cid}: ✅ No duplicates")
        continue

    print(f"\n{target_cid}: {dup_count} duplicate control mappings. Details:")
    cur.execute("""
        SELECT 
            pa."name" AS pa_name,
            c."name" AS control_name,
            uc_req."rID" AS uc_rid,
            other_req."requirementId" AS other_req_id,
            other_req."rID" AS other_rid,
            m_other."id" AS other_mapping_id
        FROM "MapControl2Requirement" m_uc
        JOIN "Requirement" uc_req ON uc_req."rID" = m_uc."requirementRId"
            AND uc_req."requirementId" = 'Unmapped Controls'
            AND uc_req."companyId" = %s
        JOIN "Control" c ON c."id" = m_uc."controlId"
        JOIN "ProcessArea" pa ON pa."id" = uc_req."processAreaId"
        -- Find another mapping for the same control in the same PA (not Unmapped Controls)
        JOIN "MapControl2Requirement" m_other ON m_other."controlId" = m_uc."controlId"
            AND m_other."requirementRId" != m_uc."requirementRId"
        JOIN "Requirement" other_req ON other_req."rID" = m_other."requirementRId"
            AND other_req."processAreaId" = pa."id"
            AND other_req."requirementId" != 'Unmapped Controls'
            AND other_req."companyId" = %s
        ORDER BY pa."name", c."name"
    """, (co_id, co_id))

    results = cur.fetchall()
    
    if not results:
        print(f"\n{target_cid}: ✅ No duplicate mappings (all controls appear only once per PA)")
        continue

    # Group by PA
    by_pa = {}
    for pa_name, ctrl_name, uc_rid, other_req_id, other_rid, other_mid in results:
        if pa_name not in by_pa:
            by_pa[pa_name] = []
        by_pa[pa_name].append((ctrl_name, uc_rid, other_req_id, other_rid, other_mid))

    print(f"\n{target_cid}: {len(results)} duplicate control mappings across {len(by_pa)} PAs")
    for pa_name, entries in sorted(by_pa.items()):
        print(f"  {pa_name} ({len(entries)} duplicates):")
        for ctrl_name, uc_rid, other_req_id, other_rid, other_mid in entries:
            print(f"    {ctrl_name[:60]}")
            print(f"      → Unmapped Controls (rID={uc_rid})")
            print(f"      → Also in: {other_req_id} (rID={other_rid})")

cur.close()
conn.close()
