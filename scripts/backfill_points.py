"""
Retroactively create ActivityLog + PointTransaction records for all completed assessments.

For each completed assessment:
1. Create an ActivityLog entry (activityType = "Complete Assessment")
2. Look up GameAttributeRules for "Complete Assessment"
3. Calculate points: base + per-control + HSSE bonus + quality bonus
4. Create PointTransaction(s) linked to the ActivityLog and GameAttribute
5. Update User.totalPoints
"""
import os, sys

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
db_url = os.environ.get('DATABASE_URL')
if not db_url and os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break

if not db_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

url = db_url.replace('postgresql://', '')
auth_host, dbname = url.rsplit('/', 1)
auth, hostport = auth_host.rsplit('@', 1)
user, password = auth.split(':', 1)
host, port = (hostport.split(':', 1) + ['5432'])[:2]

import psycopg2
conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
conn.autocommit = True
cur = conn.cursor()

# 1. Find all completed assessments
cur.execute("""
    SELECT a."id", a."name", a."assessorId", a."status",
           u."name" as "assessorName", u."totalPoints"
    FROM "Assessment" a
    JOIN "User" u ON u."id" = a."assessorId"
    WHERE a."status" = 'Completed'
    ORDER BY a."id"
""")
assessments = cur.fetchall()
print(f"Found {len(assessments)} completed assessments.\n")

if len(assessments) == 0:
    print("No completed assessments to process.")
    cur.close()
    conn.close()
    sys.exit(0)

# 2. Get all active rules for "Complete Assessment"
cur.execute("""
    SELECT r."id", r."gameAttributeId", r."basePoints", r."perControlPoints",
           r."hsseBonusPoints", r."qualityThreshold", r."qualityBonus",
           r."multiplier", ga."attributeName"
    FROM "GameAttributeRule" r
    JOIN "GameAttribute" ga ON ga."id" = r."gameAttributeId"
    WHERE r."activityType" = 'Complete Assessment' AND r."isActive" = true
""")
rules = cur.fetchall()
print(f"Loaded {len(rules)} active rules for 'Complete Assessment':")
for r in rules:
    print(f"  - {r[8]}: base={r[2]} perCtrl={r[3]} hsse={r[4]} qThresh={r[5]} qBonus={r[6]} mult={r[7]}")
print()

total_created_logs = 0
total_created_txns = 0

for a in assessments:
    assessment_id, name, assessor_id, status, assessor_name, current_points = a
    print(f"Processing: {name} (assessor: {assessor_name}, current points: {current_points})")

    # Check if already has ActivityLog + PointTransaction for this assessment
    cur.execute("""
        SELECT COUNT(*) FROM "ActivityLog"
        WHERE "activityType" = 'Complete Assessment' AND "refRecord" = %s
    """, (assessment_id,))
    if cur.fetchone()[0] > 0:
        print(f"  ⏭  Already has ActivityLog, skipping.\n")
        continue

    # Count controls assigned to this assessment
    cur.execute("""
        SELECT COUNT(*), bool_or(c."isHsseCritical")
        FROM "ControlAssignment" ca
        JOIN "Control" c ON c."id" = ca."controlId"
        WHERE ca."assessmentId" = %s
    """, (assessment_id,))
    row = cur.fetchone()
    control_count = row[0] or 0
    has_hsse = row[1] or False
    print(f"  Controls: {control_count}, HSSE critical: {has_hsse}")

    # Calculate quality score from sample pass rate
    cur.execute("""
        SELECT COUNT(*), COUNT(*) FILTER (WHERE "conclusion" = 'Pass')
        FROM "Sample"
        WHERE "assessmentId" = %s AND "status" = 'Tested'
    """, (assessment_id,))
    row = cur.fetchone()
    total_tested = row[0] or 0
    pass_count = row[1] or 0
    quality_score = round((pass_count / total_tested) * 100) if total_tested > 0 else 0
    print(f"  Samples tested: {total_tested}, passed: {pass_count}, quality: {quality_score}%")

    # Create ActivityLog
    import uuid
    log_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO "ActivityLog" ("id", "activityType", "description", "username", "refTable", "refRecord", "timestamp", "createdAt")
        VALUES (%s, 'Complete Assessment', %s, %s, 'Assessment', %s, NOW(), NOW())
    """, (log_id, f"Completed assessment: {name}", assessor_name or "system", assessment_id))
    total_created_logs += 1

    # Apply rules
    points_this_assessment = 0
    for rule in rules:
        rule_id, attr_id, base, per_ctrl, hsse_bonus, q_thresh, q_bonus, mult, attr_name = rule

        pts = base
        if per_ctrl and control_count:
            pts += per_ctrl * control_count
        if hsse_bonus and has_hsse:
            pts += hsse_bonus
        if q_thresh is not None and quality_score >= q_thresh:
            pts += q_bonus
        pts = round(pts * mult)

        if pts > 0:
            txn_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO "PointTransaction" ("id", "userId", "points", "reason", "assessmentId",
                    "gameAttributeId", "activityLogId", "multiplier", "createdAt")
                VALUES (%s, %s, %s, 'Complete Assessment', %s, %s, %s, %s, NOW())
            """, (txn_id, assessor_id, pts, assessment_id, attr_id, log_id, mult))
            total_created_txns += 1
            points_this_assessment += pts
            print(f"    +{pts} XP → {attr_name}")

    # Update user total points
    if points_this_assessment > 0:
        cur.execute("""
            UPDATE "User" SET "totalPoints" = "totalPoints" + %s WHERE "id" = %s
        """, (points_this_assessment, assessor_id))
        print(f"  ✅ Total: +{points_this_assessment} XP awarded. User now has {current_points + points_this_assessment} points.\n")
    else:
        print(f"  ⚠ No rules matched, no points awarded.\n")

cur.close()
conn.close()

print(f"\n{'='*50}")
print(f"Done! Created {total_created_logs} ActivityLog entries and {total_created_txns} PointTransaction records.")
