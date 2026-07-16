"""Delete all MapControl2Requirement for Unmapped Controls in SMDS and OGP."""
import psycopg2, os

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
total = 0

for cid in ['SMDS', 'OGP']:
    cur.execute('SELECT id FROM "Company" WHERE "companyID" = %s', (cid,))
    row = cur.fetchone()
    if not row:
        continue
    co_id = row[0]
    cur.execute(
        'DELETE FROM "MapControl2Requirement" m '
        'USING "Requirement" r '
        'WHERE m."requirementRId" = r."rID" '
        'AND r."requirementId" = %s '
        'AND r."companyId" = %s',
        ('Unmapped Controls', co_id)
    )
    print(f'{cid}: deleted {cur.rowcount} mappings')
    total += cur.rowcount

conn.commit()
cur.close()
conn.close()
print(f'Total deleted: {total}')
print('Done.')
