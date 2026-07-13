"""
Backfill MapControl2Requirement: maps Controls to Requirements via shared ProcessArea.
One requirement can have many controls; one control can map to many requirements.
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
    print("Creating MapControl2Requirement table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS "MapControl2Requirement" (
            "id" TEXT PRIMARY KEY,
            "controlId" TEXT NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
            "requirementRId" INTEGER NOT NULL REFERENCES "Requirement"("rID") ON DELETE CASCADE,
            "processAreaId" TEXT,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("controlId", "requirementRId")
        )
    """)
    print("Table ready.")

    # Step 2: Backfill via shared ProcessArea
    print("Backfilling mappings via shared ProcessArea...")
    cur.execute("""
        INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId")
        SELECT DISTINCT
            gen_random_uuid()::text,
            c.id,
            r."rID",
            pa.id
        FROM "Control" c
        JOIN "ProcessArea" pa ON c."processAreaId" = pa.id
        JOIN "Requirement" r ON r."processAreaId" = pa.id
        WHERE NOT EXISTS (
            SELECT 1 FROM "MapControl2Requirement" m
            WHERE m."controlId" = c.id AND m."requirementRId" = r."rID"
        )
    """)
    print(f"Backfilled: {cur.rowcount} mappings")

    # Step 3: Stats
    cur.execute('SELECT COUNT(*) FROM "MapControl2Requirement"')
    total = cur.fetchone()[0]
    cur.execute('SELECT COUNT(DISTINCT "controlId") FROM "MapControl2Requirement"')
    controls_mapped = cur.fetchone()[0]
    cur.execute('SELECT COUNT(DISTINCT "requirementRId") FROM "MapControl2Requirement"')
    reqs_mapped = cur.fetchone()[0]
    print(f"\nTotal mappings: {total}")
    print(f"Unique controls mapped: {controls_mapped}")
    print(f"Unique requirements mapped: {reqs_mapped}")

    cur.execute('SELECT COUNT(*) FROM "Control"')
    total_controls = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "Requirement"')
    total_reqs = cur.fetchone()[0]
    print(f"\nTotal controls in DB: {total_controls}")
    print(f"Total requirements in DB: {total_reqs}")
    if total_controls > 0:
        print(f"Control coverage: {controls_mapped}/{total_controls} ({100*controls_mapped//total_controls}%)")
    if total_reqs > 0:
        print(f"Requirement coverage: {reqs_mapped}/{total_reqs} ({100*reqs_mapped//total_reqs}%)")

    # Sample
    cur.execute("""
        SELECT m."controlId", c.name, m."requirementRId", r."requirementId", pa.name
        FROM "MapControl2Requirement" m
        JOIN "Control" c ON m."controlId" = c.id
        JOIN "Requirement" r ON m."requirementRId" = r."rID"
        LEFT JOIN "ProcessArea" pa ON m."processAreaId" = pa.id
        LIMIT 5
    """)
    print("\nSample mappings:")
    for row in cur.fetchall():
        print(f"  Control: {row[1][:40]} → Req rID={row[2]} ({row[3]}) [PA: {row[4]}]")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
