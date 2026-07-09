"""Check ControlSubProcess records for a specific control."""
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
cur = c.cursor()

# Find the control
cur.execute("SELECT id, name, \"subProcessId\" FROM \"Control\" WHERE name ILIKE '%dispersion%'")
controls = cur.fetchall()
for ctrl in controls:
    print(f"Control: {ctrl[1]} (id={ctrl[0]}, subProcessId={ctrl[2]})")
    cur.execute("SELECT cs.*, sp.name FROM \"ControlSubProcess\" cs JOIN \"SubProcess\" sp ON sp.id = cs.\"subProcessId\" WHERE cs.\"controlId\" = %s", (ctrl[0],))
    bridges = cur.fetchall()
    print(f"  Bridge records: {len(bridges)}")
    for b in bridges:
        print(f"    - subProcess: {b[-1]}, isPrimary: {b[3]}")
    if not bridges:
        # Check if migration missed this control
        cur.execute("SELECT id, name FROM \"SubProcess\" WHERE id = %s", (ctrl[2],))
        sp = cur.fetchone()
        print(f"  Primary subProcess from Control: {sp[1] if sp else 'N/A'}")

cur.close()
c.close()
