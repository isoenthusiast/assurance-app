"""Fix ALL invalid ControlType values in ControlFromDocument and Control tables."""
import os, sys, psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_url = None
for env_file in ['.env', '.env.local']:
    env_path = os.path.join(os.getcwd(), env_file)
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    if db_url:
        break

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor()

# Valid ControlType enum values from Prisma schema
VALID = {'Administrative', 'Procedural', 'Analytical', 'Behavioral', 'Informational', 'Engineering'}

# Mapping for known invalid values → valid
MAPPING = {
    'Operational': 'Procedural',
    'Behavioural': 'Behavioral',
    'Technical': 'Procedural',
    'Procedurl': 'Procedural',
    'Adminstrative': 'Administrative',
    'Analitical': 'Analytical',
    'Engineer': 'Engineering',
    'Behavior': 'Behavioral',
    'Information': 'Informational',
}

# 1. Find all distinct controlType values in ControlFromDocument
cur.execute('''SELECT DISTINCT "controlType" FROM "ControlFromDocument"''')
for row in cur.fetchall():
    val = row[0]
    if val not in VALID:
        mapped = MAPPING.get(val, 'Administrative')
        cur.execute(
            '''UPDATE "ControlFromDocument" SET "controlType" = %s WHERE "controlType" = %s''',
            (mapped, val)
        )
        count = cur.rowcount
        print(f"Fixed ControlFromDocument: '{val}' → '{mapped}' ({count} rows)")

# 2. Check Control table too
cur.execute('''SELECT DISTINCT "controlType" FROM "Control"''')
for row in cur.fetchall():
    val = row[0]
    if val not in VALID:
        mapped = MAPPING.get(val, 'Administrative')
        cur.execute(
            '''UPDATE "Control" SET "controlType" = %s WHERE "controlType" = %s''',
            (mapped, val)
        )
        count = cur.rowcount
        print(f"Fixed Control: '{val}' → '{mapped}' ({count} rows)")

# 3. Verify
cur.execute('''SELECT "controlType", COUNT(*) FROM "ControlFromDocument" GROUP BY "controlType" ORDER BY "controlType"''')
print("\nControlFromDocument distribution:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.close()
conn.close()
print("\nDone")
