"""Clean and remap Unmapped Controls for SMDS and OGP from SAMS001 template."""
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

TARGET_COMPANIES = ['SMDS', 'OGP']

# Get SAMS001 company ID
cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = 'SAMS001'")
sams_id = cur.fetchone()[0]
print(f"SAMS001 ID: {sams_id}")

for target_cid in TARGET_COMPANIES:
    # Get target company ID
    cur.execute("SELECT id FROM \"Company\" WHERE \"companyID\" = %s", (target_cid,))
    row = cur.fetchone()
    if not row:
        print(f"Company {target_cid} not found, skipping.")
        continue
    target_id = row[0]
    print(f"\n=== Processing {target_cid} (ID: {target_id}) ===")

    # For each standard, get SAMS Unmapped Controls and the target's Unmapped Controls
    cur.execute("""
        SELECT 
            s."standard",
            sr."rID" AS sams_rid,
            tr."rID" AS target_rid,
            sr."processAreaId" AS sams_pa_id,
            tr."processAreaId" AS target_pa_id
        FROM "Standard" s
        JOIN "Requirement" sr ON sr."standard" = s."standard" 
            AND sr."requirementId" = 'Unmapped Controls' 
            AND sr."companyId" = %s
        JOIN "Requirement" tr ON tr."standard" = s."standard" 
            AND tr."requirementId" = 'Unmapped Controls' 
            AND tr."companyId" = %s
        ORDER BY s."standard"
    """, (sams_id, target_id))
    
    pairs = cur.fetchall()
    total_deleted = 0
    total_copied = 0
    
    for standard, sams_rid, target_rid, sams_pa_id, target_pa_id in pairs:
        # 1. Delete all existing MapControl2Requirement for the target's Unmapped Controls
        cur.execute(
            'DELETE FROM "MapControl2Requirement" WHERE "requirementRId" = %s',
            (target_rid,)
        )
        deleted = cur.rowcount
        total_deleted += deleted
        
        # 2. Get SAMS control mappings for Unmapped Controls
        cur.execute("""
            SELECT m."controlId", c."name" AS control_name
            FROM "MapControl2Requirement" m
            JOIN "Control" c ON c."id" = m."controlId" AND c."companyId" = %s
            WHERE m."requirementRId" = %s
        """, (sams_id, sams_rid))
        sams_mappings = cur.fetchall()
        
        # 3. For each SAMS mapping, find the equivalent control in the target company (by name)
        copied = 0
        for ctrl_id, ctrl_name in sams_mappings:
            cur.execute("""
                SELECT "id" FROM "Control"
                WHERE "name" = %s AND "companyId" = %s
                LIMIT 1
            """, (ctrl_name, target_id))
            ctrl_row = cur.fetchone()
            if not ctrl_row:
                print(f"  ⚠ Control '{ctrl_name}' not found in {target_cid}, skipping.")
                continue
            
            target_ctrl_id = ctrl_row[0]
            new_id = f"m2r_{target_rid}_{target_ctrl_id[:8]}"
            try:
                cur.execute("""
                    INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId")
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (new_id, target_ctrl_id, target_rid, target_pa_id))
                if cur.rowcount > 0:
                    copied += 1
            except Exception as e:
                print(f"  ✗ Failed to insert mapping for '{ctrl_name}': {e}")
        
        total_copied += copied
        print(f"  {standard}: deleted {deleted}, copied {copied} mappings")
    
    print(f"  TOTAL: deleted {total_deleted}, copied {total_copied} mappings")

conn.commit()
cur.close()
conn.close()
print("\nDone. Verify in the app.")
