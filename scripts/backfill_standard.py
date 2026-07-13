"""
Backfill Standard table from distinct Requirement.standard values.
Populates standard, standardDescription, and sequenceNo.
"""
import psycopg2
import os

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

    # Step 1: Create table
    print("Creating Standard table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS "Standard" (
            "id" TEXT PRIMARY KEY,
            "standard" TEXT NOT NULL UNIQUE,
            "standardDescription" TEXT,
            "sequenceNo" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Table ready.")

    # Step 2: Backfill from Requirement.standard distinct values
    print("Backfilling from Requirement.standard...")
    cur.execute("""
        INSERT INTO "Standard" ("id", "standard", "sequenceNo")
        SELECT DISTINCT
            gen_random_uuid()::text,
            r.standard,
            ROW_NUMBER() OVER (ORDER BY MIN(r."rID"))
        FROM "Requirement" r
        WHERE r.standard IS NOT NULL AND r.standard != ''
          AND NOT EXISTS (SELECT 1 FROM "Standard" s WHERE s.standard = r.standard)
        GROUP BY r.standard
        ON CONFLICT ("standard") DO NOTHING
    """)
    print(f"Backfilled: {cur.rowcount} standards")

    # Step 3: Also pull from ProcessArea.standard
    cur.execute("""
        INSERT INTO "Standard" ("id", "standard", "sequenceNo")
        SELECT DISTINCT
            gen_random_uuid()::text,
            pa.standard,
            900 + ROW_NUMBER() OVER (ORDER BY pa.standard)
        FROM "ProcessArea" pa
        WHERE pa.standard IS NOT NULL AND pa.standard != ''
          AND NOT EXISTS (SELECT 1 FROM "Standard" s WHERE s.standard = pa.standard)
        ON CONFLICT ("standard") DO NOTHING
    """)
    print(f"From ProcessArea: {cur.rowcount} additional")

    # Step 4: List all standards
    cur.execute('SELECT "id", "standard", "sequenceNo" FROM "Standard" ORDER BY "sequenceNo"')
    rows = cur.fetchall()
    print(f"\nTotal standards: {len(rows)}")
    for r in rows:
        desc = r[1][:60] if r[1] else "(empty)"
        print(f"  seq={r[2]}  id={r[0][:20]}...  {desc}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
