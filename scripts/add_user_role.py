"""Create UserRole table."""
import os, sys
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
db_url = os.environ.get('DATABASE_URL')
if not db_url and os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if line.strip().startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
if not db_url: print("ERROR"); sys.exit(1)
url = db_url.replace('postgresql://', '')
ah, db = url.rsplit('/', 1)
a, hp = ah.rsplit('@', 1)
u, p = a.split(':', 1)
h, pt = (hp.split(':', 1) + ['5432'])[:2]
import psycopg2
c = psycopg2.connect(host=h, port=pt, user=u, password=p, dbname=db)
c.autocommit = True
cur = c.cursor()
cur.execute("""
    CREATE TABLE IF NOT EXISTS "UserRole" (
        "id" TEXT PRIMARY KEY,
        "roleName" TEXT NOT NULL UNIQUE,
        "roleDescription" TEXT,
        "roleFunction" TEXT,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
""")
print("✓ UserRole table ready.")
cur.close()
c.close()
