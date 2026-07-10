"""
1. Ensure SMDS and OGP companies exist in the Company table
2. Assign all users to SMDS, except Denry/Shahsha → OGP
"""
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

# 1. Ensure SMDS company exists
cur.execute("""SELECT id FROM "Company" WHERE "companyID" = 'SMDS'""")
smds = cur.fetchone()
if not smds:
    cur.execute("""INSERT INTO "Company" (id, "companyID", "companyName", "shortName") VALUES ('comp_smds', 'SMDS', 'Shell Middle Distillate Synthesis', 'SMDS')""")
    smds_id = 'comp_smds'
    print("Created SMDS company")
else:
    smds_id = smds[0]
    print(f"SMDS exists: {smds_id}")

# 2. Ensure OGP company exists
cur.execute("""SELECT id FROM "Company" WHERE "companyID" = 'OGP'""")
ogp = cur.fetchone()
if not ogp:
    cur.execute("""INSERT INTO "Company" (id, "companyID", "companyName", "shortName") VALUES ('comp_ogp', 'OGP', 'Oil & Gas Pipeline', 'OGP')""")
    ogp_id = 'comp_ogp'
    print("Created OGP company")
else:
    ogp_id = ogp[0]
    print(f"OGP exists: {ogp_id}")

# 3. List all users
cur.execute("""SELECT id, name, username FROM "User" ORDER BY username""")
users = cur.fetchall()

smds_count = 0
ogp_count = 0
ogp_usernames = ['denry', 'shahsha']  # case-insensitive match

for user in users:
    uid, name, username = user
    uname_lower = (username or '').lower()
    
    if uname_lower in ogp_usernames:
        cur.execute("""UPDATE "User" SET "companyId" = %s WHERE id = %s""", (ogp_id, uid))
        ogp_count += 1
        print(f"  {name} ({username}) → OGP")
    else:
        cur.execute("""UPDATE "User" SET "companyId" = %s WHERE id = %s""", (smds_id, uid))
        smds_count += 1

print(f"\nAssigned: {smds_count} → SMDS, {ogp_count} → OGP")

# 4. Verify
cur.execute("""SELECT u.username, u.name, c."companyName" FROM "User" u LEFT JOIN "Company" c ON c.id = u."companyId" ORDER BY u.username""")
print("\nVerification:")
for row in cur.fetchall():
    print(f"  {row[0]:20s} → {row[2] or 'NONE':20s} ({row[1]})")

cur.close()
conn.close()
print("\n✅ Done.")
