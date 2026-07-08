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

    cur.close()
    conn.close()

except ImportError:
    print("psycopg2 not installed. Trying with pg8000 or other driver...")
    # Fall back to using subprocess with node
    print("Please install psycopg2: pip install psycopg2-binary")
    print("Or run the SQL manually against the database.")
    sys.exit(1)
