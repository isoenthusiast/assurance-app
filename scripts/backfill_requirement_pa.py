"""
Backfill Requirement.processAreaId from ProcessArea via pID → pId mapping.
Adds the column if it doesn't exist, then populates it.
"""
import psycopg2
import os
import sys

def get_connection():
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
        raise RuntimeError("DATABASE_URL not found")

    url = db_url.replace('postgresql://', '')
    auth_host, dbname = url.rsplit('/', 1)
    auth, hostport = auth_host.rsplit('@', 1)
    user, password = auth.split(':', 1)
    host, port = (hostport.split(':', 1) + ['5432'])[:2]
    return psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname, sslmode='require')


def main():
    conn = get_connection()
    conn.autocommit = True
    cur = conn.cursor()

    # Step 1: Add column if not exists
    print("Adding processAreaId column...")
    cur.execute('ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "processAreaId" TEXT')
    print("Column ready.")

    # Step 2: Backfill — match Requirement.pID → ProcessArea.pId
    print("Backfilling processAreaId...")
    cur.execute("""
        UPDATE "Requirement" r
        SET "processAreaId" = pa.id
        FROM "ProcessArea" pa
        WHERE r."pID" = pa."pId" AND r."processAreaId" IS NULL
    """)
    updated = cur.rowcount
    print(f"Backfilled: {updated} rows")

    # Step 3: Count unmatched
    cur.execute('SELECT COUNT(*) FROM "Requirement" WHERE "processAreaId" IS NULL')
    unmatched = cur.fetchone()[0]
    if unmatched > 0:
        print(f"⚠ {unmatched} requirements have no matching ProcessArea (pID not found)")

    # Step 4: Sample verification
    cur.execute("""
        SELECT r."rID", r."pID", r."processAreaId", pa.name
        FROM "Requirement" r
        LEFT JOIN "ProcessArea" pa ON r."processAreaId" = pa.id
        WHERE r."processAreaId" IS NOT NULL
        ORDER BY r."rID" LIMIT 5
    """)
    print("\nSample (first 5 matched):")
    for row in cur.fetchall():
        print(f"  rID={row[0]}  pID={row[1]}  processAreaId={row[2][:20]}...  PA={row[3]}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
