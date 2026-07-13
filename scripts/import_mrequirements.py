"""
Import mRequirement.csv into Requirement table.
Creates table if not exists, then bulk-inserts all rows.
rID is the primary key (from source CSV).
"""
import psycopg2
import csv
import os
import sys
from datetime import datetime

# ── DB connection ──────────────────────────────────────────────────────
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
    print("Creating Requirement table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS "Requirement" (
            "rID" INTEGER PRIMARY KEY,
            "standard" TEXT NOT NULL,
            "pID" TEXT NOT NULL,
            "requirementId" TEXT NOT NULL,
            "clauseContent" TEXT NOT NULL,
            "intentOutcome" TEXT NOT NULL,
            "clauseApplicability" TEXT NOT NULL,
            "references" TEXT,
            "applicable" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    print("Table ready.")

    # Step 2: Import CSV
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'frontline library', 'mRequirement.csv')
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontline library', 'mRequirement.csv')
    
    print(f"Reading: {csv_path}")
    
    inserted = 0
    skipped = 0

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        # Use executemany for speed
        batch = []
        for row in reader:
            if not row[3].strip():
                continue
            rID = int(row[3].strip())
            standard = row[1].strip()
            pID = row[2].strip()
            requirementId = row[4].strip()
            clauseContent = row[5].strip()
            intentOutcome = row[6].strip()
            clauseApplicability = row[7].strip()
            references = row[8].strip() if row[8].strip() else None
            applicable = row[9].strip().upper() == 'TRUE' if row[9].strip() else True
            
            batch.append((rID, standard, pID, requirementId, clauseContent, intentOutcome, clauseApplicability, references, applicable))
            
            if len(batch) >= 50:
                try:
                    cur.executemany("""
                        INSERT INTO "Requirement" ("rID", "standard", "pID", "requirementId", "clauseContent", "intentOutcome", "clauseApplicability", "references", "applicable")
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT ("rID") DO NOTHING
                    """, batch)
                    inserted += cur.rowcount
                    skipped += len(batch) - cur.rowcount
                except Exception as e:
                    print(f"Batch error: {e}")
                    conn.rollback()
                batch = []
        
        # Final batch
        if batch:
            try:
                cur.executemany("""
                    INSERT INTO "Requirement" ("rID", "standard", "pID", "requirementId", "clauseContent", "intentOutcome", "clauseApplicability", "references", "applicable")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT ("rID") DO NOTHING
                """, batch)
                inserted += cur.rowcount
                skipped += len(batch) - cur.rowcount
            except Exception as e:
                print(f"Final batch error: {e}")

    print(f"\nImported: {inserted} rows")
    if skipped > 0:
        print(f"Skipped (duplicates): {skipped} rows")

    # Step 3: Verify
    cur.execute('SELECT COUNT(*) FROM "Requirement"')
    count = cur.fetchone()[0]
    print(f"Total in table: {count} rows")

    # Step 4: Sample
    cur.execute('SELECT "rID", "standard", "requirementId" FROM "Requirement" ORDER BY "rID" LIMIT 5')
    print("\nFirst 5 rows:")
    for row in cur.fetchall():
        print(f"  rID={row[0]}  standard={row[1][:50]}  reqID={row[2]}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == '__main__':
    main()
