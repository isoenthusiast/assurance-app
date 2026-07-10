"""
Recalculate Control.rawHealthScore based on ControlAssignment records
from the last 90 days.

Formula: (Effective assignments / Total assignments) * 100
If no assessments in 90 days → 0
"""
import os, sys
import psycopg2
from datetime import datetime, timedelta

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = os.environ.get('DATABASE_URL')
if not db_url:
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not db_url:
    print("ERROR: DATABASE_URL not found")
    sys.exit(1)

print("Connecting to database...")
conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Calculate the cutoff date (90 days ago)
cutoff = datetime.now() - timedelta(days=90)
print(f"Cutoff date: {cutoff.strftime('%Y-%m-%d')} (90 days ago)")

try:
    # Step 1: For each control, count Effective and Total assignments in last 90 days
    print("\n1. Calculating control health scores from ControlAssignments...")
    cur.execute("""
        WITH assignment_stats AS (
            SELECT
                ca."controlId",
                COUNT(*)::int AS total_assignments,
                COUNT(*) FILTER (WHERE ca."effective" = 'Effective')::int AS effective_assignments
            FROM "ControlAssignment" ca
            JOIN "Assessment" a ON a."id" = ca."assessmentId"
            WHERE a."createdAt" >= %s
            GROUP BY ca."controlId"
        )
        SELECT
            c."id",
            COALESCE(s.total_assignments, 0) AS total,
            COALESCE(s.effective_assignments, 0) AS effective,
            CASE
                WHEN COALESCE(s.total_assignments, 0) = 0 THEN 0
                ELSE ROUND((s.effective_assignments::float / s.total_assignments) * 100)
            END AS new_score
        FROM "Control" c
        LEFT JOIN assignment_stats s ON s."controlId" = c."id"
    """, (cutoff,))

    results = cur.fetchall()
    print(f"   Computed scores for {len(results)} controls.")

    # Step 2: Update Control.rawHealthScore
    updated = 0
    for row in results:
        control_id, total, effective, new_score = row
        cur.execute(
            'UPDATE "Control" SET "rawHealthScore" = %s WHERE "id" = %s',
            (int(new_score), control_id)
        )
        updated += 1

    print(f"   ✓ Updated {updated} controls.")

    # Step 3: Summary
    cur.execute("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE "rawHealthScore" = 0) AS zero_score,
            COUNT(*) FILTER (WHERE "rawHealthScore" > 0 AND "rawHealthScore" <= 50) AS low,
            COUNT(*) FILTER (WHERE "rawHealthScore" > 50 AND "rawHealthScore" <= 80) AS mid,
            COUNT(*) FILTER (WHERE "rawHealthScore" > 80) AS high,
            ROUND(AVG("rawHealthScore"), 1) AS overall_avg
        FROM "Control"
    """)
    stats = cur.fetchone()
    print(f"\n2. Distribution:")
    print(f"   Total controls: {stats[0]}")
    print(f"   Zero score (not assessed): {stats[1]}")
    print(f"   Low (1-50%): {stats[2]}")
    print(f"   Mid (51-80%): {stats[3]}")
    print(f"   High (>80%): {stats[4]}")
    print(f"   Overall average: {stats[5]}%")

    print("\n✅ Health scores recalculated!")
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    cur.close()
    conn.close()
