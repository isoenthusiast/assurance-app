"""
Map ControlFromDocument records to SubProcesses via ControlFDSubProcess junction.
Strategy: For each CFD with a populated processAreaId, match to SubProcesses
in that ProcessArea using keyword/content similarity.
"""
import os, sys, re, psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── DB ──
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

# ── 1. Load SubProcesses grouped by ProcessArea ──
print("Loading SubProcesses by ProcessArea...")
cur.execute('''
    SELECT sp.id, sp.name, sp."processAreaId", pa.name as pa_name
    FROM "SubProcess" sp
    JOIN "ProcessArea" pa ON pa.id = sp."processAreaId"
    ORDER BY pa.name, sp.name
''')
subprocesses = {}
for row in cur.fetchall():
    sp_id, sp_name, pa_id, pa_name = row
    if pa_id not in subprocesses:
        subprocesses[pa_id] = []
    subprocesses[pa_id].append({'id': sp_id, 'name': sp_name, 'pa_name': pa_name})

print(f"  Loaded {sum(len(v) for v in subprocesses.values())} SubProcesses across {len(subprocesses)} ProcessAreas")

# ── 2. Study existing Control→SubProcess mappings ──
print("\nStudying existing ControlSubProcess patterns...")
cur.execute('''
    SELECT c.name as ctrl_name, sp.name as sp_name, pa.name as pa_name, cs."isPrimary"
    FROM "ControlSubProcess" cs
    JOIN "Control" c ON c.id = cs."controlId"
    JOIN "SubProcess" sp ON sp.id = cs."subProcessId"
    JOIN "ProcessArea" pa ON pa.id = sp."processAreaId"
    ORDER BY RANDOM()
    LIMIT 20
''')
print("  Sample existing mappings:")
for row in cur.fetchall():
    print(f"    [{row[2][:30]:30s}] {row[1][:40]:40s} ← {row[0][:60]}")

# ── 3. Load ControlFromDocument with processAreaId populated ──
print("\nLoading ControlFromDocument records with processAreaId...")
cur.execute('''
    SELECT cfd.id, cfd.name, cfd.statement, cfd."processAreaId",
           cfd."csfWho", cfd."csfWhat", cfd."csfWhen", cfd."csfWhere",
           cfd."csfWhy", cfd."csfHow", cfd."csfEvidence",
           cfd."controlRef", cfd."controlType"
    FROM "ControlFromDocument" cfd
    WHERE cfd."processAreaId" IS NOT NULL AND cfd."processAreaId" != ''
''')
cfds = cur.fetchall()
print(f"  Loaded {len(cfds)} CFD records with processAreaId")

# ── 4. Build tokenized SubProcess index per ProcessArea ──
def tokenize(text):
    return set(re.findall(r'[a-z0-9]{3,}', text.lower()))

sp_index = {}  # pa_id → [(sp_id, tokens, sp_name)]
for pa_id, sps in subprocesses.items():
    sp_index[pa_id] = []
    for sp in sps:
        tokens = tokenize(sp['name'])
        sp_index[pa_id].append((sp['id'], tokens, sp['name']))

# ── 5. Match each CFD to SubProcesses ──
print(f"\nMatching {len(cfds)} CFD records to SubProcesses...")

import uuid
inserted = 0
batch = []
BATCH_SIZE = 100
now = "NOW()"

for cfd in cfds:
    cfd_id = cfd[0]
    cfd_name = cfd[1] or ''
    statement = cfd[2] or ''
    pa_id = cfd[3]
    csf_fields = ' '.join([cfd[i] or '' for i in range(4, 11)])

    if pa_id not in sp_index:
        continue

    # Build search text
    search_tokens = tokenize(f"{cfd_name} {statement} {csf_fields}")

    candidates = sp_index[pa_id]
    matches = []

    for sp_id, sp_tokens, sp_name in candidates:
        overlap = search_tokens & sp_tokens
        if len(overlap) >= 3:  # minimum 3 token overlap
            confidence = len(overlap) / max(len(sp_tokens), 1)
            matches.append((sp_id, sp_name, confidence, len(overlap)))

    if not matches:
        continue

    # Sort by confidence, take top match as primary
    matches.sort(key=lambda x: -x[2])
    primary_sp_id = matches[0][0]

    # Insert primary mapping (and secondary if confidence > 0.5)
    for i, (sp_id, sp_name, conf, overlap_count) in enumerate(matches[:3]):
        if conf < 0.15:  # too weak
            break
        is_primary = (i == 0)
        batch.append((str(uuid.uuid4()), cfd_id, sp_id, is_primary))

    if len(batch) >= BATCH_SIZE:
        cur.executemany(
            'INSERT INTO "ControlFDSubProcess" ("id", "controlFromDocumentId", "subProcessId", "isPrimary") VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING',
            batch
        )
        inserted += len(batch)
        print(f"  Inserted {inserted}...", end='\r')
        batch = []

# Final batch
if batch:
    cur.executemany(
        'INSERT INTO "ControlFDSubProcess" ("id", "controlFromDocumentId", "subProcessId", "isPrimary") VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING',
        batch
    )
    inserted += len(batch)

print(f"\n  Total inserted: {inserted} ControlFDSubProcess mappings")

# ── 6. Show results ──
cur.execute('SELECT COUNT(*) FROM "ControlFDSubProcess"')
total = cur.fetchone()[0]
cur.execute('SELECT COUNT(DISTINCT "controlFromDocumentId") FROM "ControlFDSubProcess"')
unique_cfds = cur.fetchone()[0]
print(f"\n  Stats: {total} mappings for {unique_cfds} unique CFD records")

print("\n  Sample mappings:")
cur.execute('''
    SELECT cfd.name, sp.name as sp_name, pa.name as pa_name, cfds."isPrimary"
    FROM "ControlFDSubProcess" cfds
    JOIN "ControlFromDocument" cfd ON cfd.id = cfds."controlFromDocumentId"
    JOIN "SubProcess" sp ON sp.id = cfds."subProcessId"
    JOIN "ProcessArea" pa ON pa.id = sp."processAreaId"
    ORDER BY RANDOM()
    LIMIT 15
''')
for row in cur.fetchall():
    marker = '★' if row[3] else ' '
    print(f"    {marker} [{row[2][:30]:30s}] {row[1][:40]:40s} ← {row[0][:60]}")

# ── 7. Coverage stats ──
cur.execute('''
    SELECT pa.name, COUNT(DISTINCT cfds."controlFromDocumentId") as cfd_count,
           COUNT(*) as mapping_count
    FROM "ControlFDSubProcess" cfds
    JOIN "SubProcess" sp ON sp.id = cfds."subProcessId"
    JOIN "ProcessArea" pa ON pa.id = sp."processAreaId"
    GROUP BY pa.name
    ORDER BY cfd_count DESC
    LIMIT 20
''')
print("\n  Top 20 ProcessAreas by CFD coverage:")
for row in cur.fetchall():
    print(f"    {row[0][:50]:50s} {row[1]:4d} CFDs, {row[2]:4d} mappings")

cur.close()
conn.close()
print("\n✅ Done.")
