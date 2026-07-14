"""
Direct PostgreSQL schema sync using psycopg2.
Reads DATABASE_URL from .env.local and applies schema changes.
"""
import os
import sys

# Read DATABASE_URL from environment or .env file
db_url = os.environ.get('DATABASE_URL')

if not db_url:
    # Try reading from .env (one level up from scripts/)
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not db_url:
    print("ERROR: DATABASE_URL not found in .env.local")
    sys.exit(1)

# Parse URL: postgresql://user:pass@host:port/dbname
try:
    # postgresql://postgres:password@host:54471/railway
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
    print(f"URL: {db_url}")
    sys.exit(1)

print(f"Connecting to {host}:{port}/{dbname} as {user}...")

try:
    import psycopg2
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        dbname=dbname,
    )
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected!")

    # 1. Add actionTaken column
    print("\n1. Adding actionTaken to Action...")
    try:
        cur.execute('ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "actionTaken" TEXT')
        print("   ✓ actionTaken column ready.")
    except Exception as e:
        print(f"   ⚠ {e}")

    # 2. Create Attachment table
    print("2. Creating Attachment table...")
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "Attachment" (
                "id" TEXT PRIMARY KEY,
                "description" TEXT,
                "fileName" TEXT NOT NULL,
                "filePath" TEXT NOT NULL,
                "fileSize" INTEGER,
                "uploadedBy" TEXT NOT NULL,
                "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✓ Attachment table ready.")
    except Exception as e:
        print(f"   ⚠ {e}")

    # 3. Create AttachmentMapping table
    print("3. Creating AttachmentMapping table...")
    try:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS "AttachmentMapping" (
                "id" TEXT PRIMARY KEY,
                "attachmentId" TEXT NOT NULL REFERENCES "Attachment"("id") ON DELETE CASCADE,
                "destTable" TEXT NOT NULL,
                "recId" TEXT NOT NULL
            )
        """)
        print("   ✓ AttachmentMapping table ready.")
    except Exception as e:
        print(f"   ⚠ {e}")

    # 4. Create indexes
    print("4. Creating indexes...")
    try:
        cur.execute('CREATE INDEX IF NOT EXISTS "AttachmentMapping_destTable_recId_idx" ON "AttachmentMapping" ("destTable", "recId")')
        print("   ✓ destTable+recId index ready.")
    except Exception as e:
        print(f"   ⚠ {e}")

    try:
        cur.execute('CREATE INDEX IF NOT EXISTS "AttachmentMapping_attachmentId_idx" ON "AttachmentMapping" ("attachmentId")')
        print("   ✓ attachmentId index ready.")
    except Exception as e:
        print(f"   ⚠ {e}")

    print("\n✅ Schema sync complete!")

    # 5. Add cascade FK constraints (Assessment → Aact → children)
    print("\n5. Cleaning orphans & adding cascade foreign keys...")
    
    # First clean orphan records in child tables referencing non-existent Aact.aaID
    orphan_cleanups = [
        ('DELETE FROM "AActControls" WHERE "aaId" NOT IN (SELECT "aaID" FROM "Aact")', 'AActControls'),
        ('DELETE FROM "AActUsers" WHERE "aaId" NOT IN (SELECT "aaID" FROM "Aact")', 'AActUsers'),
        ('DELETE FROM "AActDetails" WHERE "aaId" NOT IN (SELECT "aaID" FROM "Aact")', 'AActDetails'),
    ]
    for sql, label in orphan_cleanups:
        try:
            cur.execute(sql)
            if cur.rowcount > 0:
                print(f"   🧹 Removed {cur.rowcount} orphan {label} record(s).")
        except Exception as e:
            print(f"   ⚠ Cleanup {label}: {str(e)[:100]}")

    # Also create indexes for FK columns
    fk_indexes = [
        'CREATE INDEX IF NOT EXISTS "idx_Aact_assuranceID" ON "Aact" ("assuranceID")',
        'CREATE INDEX IF NOT EXISTS "idx_AActControls_aaId" ON "AActControls" ("aaId")',
        'CREATE INDEX IF NOT EXISTS "idx_AActUsers_aaId" ON "AActUsers" ("aaId")',
        'CREATE INDEX IF NOT EXISTS "idx_AActDetails_aaId" ON "AActDetails" ("aaId")',
    ]
    for idx_sql in fk_indexes:
        try:
            cur.execute(idx_sql)
        except Exception:
            pass

    fk_statements = [
        # Assessment → Aact (cascade delete)
        ('ALTER TABLE "Aact" DROP CONSTRAINT IF EXISTS "Aact_assuranceID_fkey"',
         'ALTER TABLE "Aact" ADD CONSTRAINT "Aact_assuranceID_fkey" FOREIGN KEY ("assuranceID") REFERENCES "Assessment"("id") ON DELETE CASCADE'),
        # Aact → AActControls (cascade delete, references unique aaID)
        ('ALTER TABLE "AActControls" DROP CONSTRAINT IF EXISTS "AActControls_aaId_fkey"',
         'ALTER TABLE "AActControls" ADD CONSTRAINT "AActControls_aaId_fkey" FOREIGN KEY ("aaId") REFERENCES "Aact"("aaID") ON DELETE CASCADE'),
        # Aact → AActUsers (cascade delete)
        ('ALTER TABLE "AActUsers" DROP CONSTRAINT IF EXISTS "AActUsers_aaId_fkey"',
         'ALTER TABLE "AActUsers" ADD CONSTRAINT "AActUsers_aaId_fkey" FOREIGN KEY ("aaId") REFERENCES "Aact"("aaID") ON DELETE CASCADE'),
        # Aact → AActDetails (cascade delete)
        ('ALTER TABLE "AActDetails" DROP CONSTRAINT IF EXISTS "AActDetails_aaId_fkey"',
         'ALTER TABLE "AActDetails" ADD CONSTRAINT "AActDetails_aaId_fkey" FOREIGN KEY ("aaId") REFERENCES "Aact"("aaID") ON DELETE CASCADE'),
    ]
    for drop_sql, add_sql in fk_statements:
        try:
            cur.execute(drop_sql)
            cur.execute(add_sql)
            print(f"   ✓ {add_sql.split('ADD CONSTRAINT')[1].split('FOREIGN KEY')[0].strip()} cascade ready.")
        except Exception as e:
            print(f"   ⚠ Could not add FK: {str(e)[:120]}")

    print("\n✅ Schema sync complete!")

    cur.close()
    conn.close()

except ImportError:
    print("psycopg2 not installed. Trying with pg8000 or other driver...")
    # Fall back to using subprocess with node
    print("Please install psycopg2: pip install psycopg2-binary")
    print("Or run the SQL manually against the database.")
    sys.exit(1)
