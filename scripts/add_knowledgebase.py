"""
Create Knowledgebase table in PostgreSQL.
Reads DATABASE_URL from .env and creates the table if it doesn't exist.
"""
import os
import sys

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
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

try:
    url = db_url.replace('postgresql://', '')
    auth_host, dbname = url.rsplit('/', 1)
    auth, hostport = auth_host.rsplit('@', 1)
    user, password = auth.split(':', 1)
    if ':' in hostport:
        host, port = hostport.split(':', 1)
    else:
        host, port = hostport, '5432'
except Exception as e:
    print(f"ERROR parsing DATABASE_URL: {e}")
    sys.exit(1)

print(f"Connecting to {host}:{port}/{dbname} as {user}...")

try:
    import psycopg2
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
    cur = conn.cursor()

    # Check if table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'Knowledgebase'
        )
    """)
    exists = cur.fetchone()[0]

    if exists:
        print("Table 'Knowledgebase' already exists. Adding any missing columns...")
        # Add missing columns
        columns = {
            'kID': 'TEXT NOT NULL DEFAULT gen_random_uuid()',
            'knowledgeName': 'TEXT NOT NULL',
            'knowledgeContent': 'TEXT NOT NULL',
            'remarks': 'TEXT',
            'createdDate': 'TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'addedBy': 'TEXT NOT NULL',
        }
        for col, col_def in columns.items():
            try:
                cur.execute(f'ALTER TABLE "Knowledgebase" ADD COLUMN "{col}" {col_def}')
                print(f"  Added column: {col}")
            except Exception as e:
                if 'already exists' in str(e) or 'duplicate column' in str(e):
                    pass
                else:
                    print(f"  Column {col}: {e}")
    else:
        print("Creating 'Knowledgebase' table...")
        cur.execute("""
            CREATE TABLE "Knowledgebase" (
                "kID" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
                "knowledgeName" TEXT NOT NULL,
                "knowledgeContent" TEXT NOT NULL,
                "remarks" TEXT,
                "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "addedBy" TEXT NOT NULL
            )
        """)
        print("  Table created.")

    # Create indexes
    for idx_col in ['knowledgeName', 'createdDate', 'addedBy']:
        idx_name = f'Knowledgebase_{idx_col}_idx'
        try:
            cur.execute(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON "Knowledgebase" ("{idx_col}")')
        except Exception as e:
            print(f"  Index {idx_name}: {e}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done — Knowledgebase table is ready.")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
