"""
1. Drop old unique index (requirementId, standard, companyId)
2. Create new unique index (requirementId, processAreaId, companyId)  
3. Create Unmapped Controls requirement for every PA that lacks one
4. Remap controls to their PA's Unmapped Controls via ControlSubProcess chain
"""
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

# ── 1. Drop old unique index ──
print("1. Dropping old unique index...")
cur.execute('DROP INDEX IF EXISTS "Requirement_requirementId_standard_companyId_key"')
conn.commit()
print("   Done.")

# ── 2. Create new unique index ──
print("2. Creating new unique index (requirementId, processAreaId, companyId)...")
try:
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS "Requirement_requirementId_processAreaId_companyId_key" ON "Requirement"("requirementId", "processAreaId", "companyId")')
    conn.commit()
    print("   Done.")
except Exception as e:
    conn.rollback()
    print(f"   Index might have duplicates, will handle after cleanup: {e}")

# ── 3. Create Unmapped Controls for every PA that lacks one ──
print("\n3. Creating Unmapped Controls per ProcessArea...")
cur.execute('SELECT COALESCE(MAX("rID"), 0) FROM "Requirement"')
max_rid = cur.fetchone()[0]

cur.execute("""
    SELECT pa."id", pa."name", pa."standard", pa."pId", pa."companyId"
    FROM "ProcessArea" pa
    WHERE NOT EXISTS (
        SELECT 1 FROM "Requirement" r
        WHERE r."processAreaId" = pa."id"
          AND r."requirementId" = 'Unmapped Controls'
    )
    ORDER BY pa."companyId", pa."name"
""")
missing = cur.fetchall()
created = 0
for pa_id, pa_name, standard, pId, co_id in missing:
    max_rid += 1
    try:
        cur.execute("""
            INSERT INTO "Requirement" ("rID", "requirementId", "clauseContent", "intentOutcome",
                "clauseApplicability", "references", "applicable", "standard", "pID", "processAreaId", "companyId", "createdAt")
            VALUES (%s, 'Unmapped Controls', 'Controls not yet mapped to a specific requirement.',
                'Review and assign to the correct requirement.',
                'All controls', '', true, %s, %s, %s, %s, NOW())
        """, (max_rid, standard, pId, pa_id, co_id))
        created += 1
    except Exception as e:
        conn.rollback()
        print(f"   ⚠ Failed for {pa_name}: {e}")

conn.commit()
print(f"   Created {created} Unmapped Controls requirements.")

# ── 4. Remap: for each company, map controls to their PA's Unmapped Controls ──
print("\n4. Remapping controls to their PA's Unmapped Controls...")

# First, clear ALL existing Unmapped Controls mappings across ALL companies
cur.execute("""
    DELETE FROM "MapControl2Requirement" m
    USING "Requirement" r
    WHERE m."requirementRId" = r."rID"
      AND r."requirementId" = 'Unmapped Controls'
""")
cleared = cur.rowcount
print(f"   Cleared {cleared} existing Unmapped Controls mappings across all companies.")

# Now, for each company, find controls that belong to each PA and map them
# A control belongs to a PA via: Control -> ControlSubProcess -> SubProcess.processAreaId
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
    ON CONFLICT DO NOTHING
""")
mapped = cur.rowcount
conn.commit()
print(f"   Mapped {mapped} controls to their PA's Unmapped Controls.")

# ── 5. Summary per company ──
print("\n5. Summary per company:")
cur.execute("""
    SELECT co."companyID", COUNT(DISTINCT m."controlId") AS ctrl_count, COUNT(DISTINCT r."processAreaId") AS pa_count
    FROM "Company" co
    JOIN "Requirement" r ON r."companyId" = co."id" AND r."requirementId" = 'Unmapped Controls'
    LEFT JOIN "MapControl2Requirement" m ON m."requirementRId" = r."rID"
    GROUP BY co."companyID"
    ORDER BY co."companyID"
""")
for row in cur.fetchall():
    co_id, ctrl_count, pa_count = row
    print(f"   {co_id}: {ctrl_count} unmapped controls across {pa_count} PAs")

conn.commit()
cur.close()
conn.close()
print("\n✅ Done.")
