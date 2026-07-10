"""
Backfill processAreaId in ControlFromDocument by matching document content
to ProcessArea names, SubProcess names, and SEAM standard references.

Strategy (tried in order):
  1. Direct SEAM process number match (e.g., "SEAM 3.02" → process area)
  2. Document title keyword match against ProcessArea + SubProcess names
  3. Content keyword match against ProcessArea names
  4. Default to 'Uncategorized' ProcessArea (created if needed)
"""
import os, sys, re, psycopg2

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── DB connection ──
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

# ── 1. Load ProcessAreas + SubProcesses into memory ──
cur.execute('SELECT id, name, "pId" FROM "ProcessArea" ORDER BY name')
process_areas = {row[1].lower(): {'id': row[0], 'pId': row[2]} for row in cur.fetchall()}
print(f"Loaded {len(process_areas)} ProcessAreas")

cur.execute('''
    SELECT sp.name, sp."processAreaId", pa.name as pa_name
    FROM "SubProcess" sp
    JOIN "ProcessArea" pa ON pa.id = sp."processAreaId"
''')
subprocess_map = {}  # subprocess_name_lower → processAreaId
for row in cur.fetchall():
    subprocess_map[row[0].lower()] = {'paId': row[1], 'paName': row[2]}
print(f"Loaded {len(subprocess_map)} SubProcesses")

# ── 2. SEAM Process Number → ProcessArea name mapping ──
# From Control Statement Framework.md — maps SEAM process numbers to category/process names
SEAM_TO_PA_KEYWORDS = {
    '1.01': ['air quality'],
    '1.02': ['animal testing'],
    '1.03': ['biodiversity', 'ecosystem'],
    '1.04': ['circularity'],
    '1.05': ['carbon', 'greenhouse gas', 'ghg', 'energy management'],
    '1.06': ['product stewardship'],
    '1.07': ['social performance'],
    '1.08': ['soil', 'groundwater'],
    '1.09': ['waste'],
    '1.10': ['water'],
    '2.01': ['business continuity'],
    '2.02': ['contractor hss', 'contractor management'],
    '2.03': ['emergency', 'spill', 'esprm'],
    '2.04': ['hierarchy of control'],
    '2.05': ['organisation', 'organization', 'accountability', 'competence', 'people', 'skills'],
    '2.06': ['impact assessment'],
    '2.08': ['learning', 'improvement'],
    '2.09': ['management of change', 'moc'],
    '2.10': ['risk management', 'managing hss', 'manage threat', 'manage opportunit'],
    '2.11': ['performance monitoring', 'reporting', 'kpi'],
    '2.12': ['permit to work'],
    '2.13': ['projects'],
    '2.14': ['conduct assurance', 'management system', 'seam standard'],
    '3.01': ['technical standard', 'design engineering'],
    '3.02': ['asset integrity', 'process safety management', 'aipsm'],
    '3.03': ['quality product', 'ensure quality'],
    '3.04': ['safe production', 'ensure safe'],
    '3.05': ['strategic asset', 'asset management plan'],
    '3.06': ['forecast', 'plan production'],
    '3.08': ['asset care', 'equipment care', 'manage asset'],
    '3.09': ['decommissioning', 'restoration'],
    '3.10': ['integrated activity', 'planning and scheduling'],
    '3.11': ['supply chain'],
    '3.12': ['threats and opportunities'],
    '3.13': ['ot security', 'operational technology'],
    '3.14': ['hydrocarbon accounting', 'energy accounting'],
    '3.15': ['maintenance execution', 'perform maintenance'],
    '3.16': ['turnaround'],
    '3.17': ['process safety basic', 'design engineering 2'],
    '4.02': ['driver safety', 'road transport', 'journey management'],
    '4.03': ['maritime', 'marine'],
    '5.01': ['building safety'],
    '5.02': ['business travel'],
    '5.03': ['company sponsored event'],
    '5.04': ['confined space'],
    '5.06': ['control of work'],
    '5.07': ['diving', 'tunnelling'],
    '5.08': ['electrical safety'],
    '5.09': ['excavation'],
    '5.10': ['fatigue'],
    '5.11': ['fitness to work'],
    '5.12': ['health hazard', 'health management'],
    '5.13': ['hot work'],
    '5.14': ['human factor'],
    '5.15': ['ionising radiation', 'radiation'],
    '5.16': ['lifting', 'hoisting'],
    '5.17': ['personal protective', 'ppe'],
    '5.18': ['safe isolation', 'isolation'],
    '5.19': ['security'],
    '5.20': ['worker welfare', 'labour right', 'labor right'],
    '5.21': ['working at height', 'work at height'],
}

# ── 3. Build ProcessArea keyword index ──
def build_pa_index():
    """Build ProcessArea name → keywords for fuzzy matching."""
    index = {}
    for pa_name_lower, pa_data in process_areas.items():
        keywords = set()
        # Tokenize the PA name
        tokens = re.findall(r'[a-z0-9]+', pa_name_lower)
        keywords.update(tokens)
        # Add bigrams
        for i in range(len(tokens) - 1):
            keywords.add(f"{tokens[i]} {tokens[i+1]}")
        # Remove common stopwords
        stopwords = {'and', 'the', 'of', 'in', 'for', 'to', 'a', 'is', 'on', 'at', 'by', 'an', 'be', 'or', 'as', 'with'}
        keywords = {k for k in keywords if k not in stopwords and len(k) > 2}
        index[pa_name_lower] = keywords
    return index

pa_index = build_pa_index()


def match_to_process_area(name, statement, csf_fields, standard_ref):
    """
    Match a ControlFromDocument record to a ProcessArea.
    Returns (processAreaId, match_method, confidence).
    """
    search_text = f"{name} {statement} {csf_fields}".lower()

    # ── Strategy 1: SEAM process number in standard field or document text ──
    seam_match = re.search(r'(?:SEAM\s*)?(\d+\.\d{2})', standard_ref or '' + ' ' + search_text)
    if seam_match:
        seam_num = seam_match.group(1)
        if seam_num in SEAM_TO_PA_KEYWORDS:
            keywords = SEAM_TO_PA_KEYWORDS[seam_num]
            for kw in keywords:
                for pa_name, pa_data in process_areas.items():
                    if kw in pa_name:
                        return (pa_data['id'], f"SEAM {seam_num} → {kw}", 90)

    # ── Strategy 2: Document title keyword match ──
    title_lower = name.lower()
    best_score = 0
    best_pa_id = None

    for pa_name, keywords in pa_index.items():
        score = 0
        for kw in keywords:
            if kw in title_lower:
                score += 3  # title match is strong
            elif kw in search_text:
                score += 1
        if score > best_score:
            best_score = score
            best_pa_id = process_areas[pa_name]['id']

    if best_score >= 3 and best_pa_id:
        return (best_pa_id, f"keyword match (score={best_score})", min(best_score * 15, 80))

    # ── Strategy 3: SubProcess name match ──
    for sp_name, sp_data in subprocess_map.items():
        sp_tokens = set(re.findall(r'[a-z0-9]+', sp_name))
        title_tokens = set(re.findall(r'[a-z0-9]+', title_lower))
        overlap = sp_tokens & title_tokens
        if len(overlap) >= 3 and len(sp_tokens) > 0:
            return (sp_data['paId'], f"subprocess match: {sp_name[:50]}", 70)

    # ── Strategy 4: Common sense heuristics ──
    heuristic_map = {
        r'\b(?:boiler|steam|condensate|bfg|fuel gas|burner|combustion)\b': 'ensure safe production',
        r'\b(?:operating manual|operating procedure)\b': 'ensure safe production',
        r'\b(?:maintenance|repair|inspection|testing|calibrat)\b': 'perform maintenance execution',
        r'\b(?:safety|hss|hse|health safety)\b': 'organisation roles competence',
        r'\b(?:policy|procedure|standard|governance)\b': 'governance management system',
        r'\b(?:training|competenc|capability|learning)\b': 'organisation roles competence',
        r'\b(?:contractor|vendor|supplier)\b': 'contractor hss management',
        r'\b(?:emergency|spill|fire|evacuat)\b': 'esprm',
        r'\b(?:electrical|voltage|isolation|lockout)\b': 'electrical safety',
        r'\b(?:pressure|vessel|piping|pipeline|tank)\b': 'asset integrity process safety management',
        r'\b(?:lifting|hoist|crane|rigging)\b': 'lifting and hoisting',
        r'\b(?:confined space)\b': 'confined space',
        r'\b(?:hot work|welding|grinding|spark)\b': 'hot work',
        r'\b(?:excavation|trench|dig|buried)\b': 'excavation',
        r'\b(?:driving|vehicle|driver|transport|road)\b': 'driver safety',
        r'\b(?:marine|maritime|vessel|ship|jetty|berth)\b': 'maritime safety',
        r'\b(?:waste|disposal|recycl|landfill)\b': 'waste',
        r'\b(?:water|effluent|wastewater|discharge)\b': 'water in the environment',
        r'\b(?:air|emission|stack|fume|dust|pollution)\b': 'air quality',
        r'\b(?:chemical|hazardous|msds|sds|substance)\b': 'health hazard management',
        r'\b(?:security|access control|surveillance|guard)\b': 'security',
        r'\b(?:turnaround|shutdown|outage)\b': 'perform turnarounds',
        r'\b(?:work at height|fall protection|scaffold|ladder)\b': 'working at height',
        r'\b(?:permit|ptw|authorization)\b': 'permit to work',
        r'\b(?:management of change|moc|change control)\b': 'management of change',
        r'\b(?:quality|iso 9001|qms|non.conformance)\b': 'ensure quality product',
        r'\b(?:dCS|PLC|SCADA|control system|automation|IPS|SIS)\b': 'ot security',
        r'\b(?:carbon|ghg|emission|climate|energy)\b': 'ghg energy management',
        r'\b(?:fatigue|tired|rest|sleep)\b': 'fatigue risk management',
        r'\b(?:business continuity|disaster recovery|bcp|drp)\b': 'business continuity management',
        r'\b(?:incident|accident|investigation|root cause)\b': 'learning improvement',
        r'\b(?:audit|assessment|assurance|verification|compliance)\b': 'conduct assurance',
        r'\b(?:corrosion|integrity|nde|ndt|inspection|thickness)\b': 'asset integrity process safety management',
    }

    for pattern, pa_name_keyword in heuristic_map.items():
        if re.search(pattern, search_text, re.IGNORECASE):
            # Find matching ProcessArea
            for pa_name, pa_data in process_areas.items():
                if pa_name_keyword in pa_name:
                    return (pa_data['id'], f"heuristic: {pattern}", 60)

    # ── Strategy 5: Default to Uncategorized ──
    return (get_or_create_uncategorized(), "uncategorized (fallback)", 10)


def get_or_create_uncategorized():
    """Get or create an 'Uncategorized' ProcessArea."""
    cur.execute("SELECT id FROM \"ProcessArea\" WHERE name = 'Uncategorized'")
    row = cur.fetchone()
    if row:
        return row[0]
    import uuid
    uid = str(uuid.uuid4())
    cur.execute(
        'INSERT INTO "ProcessArea" (id, name, description) VALUES (%s, %s, %s)',
        (uid, 'Uncategorized', 'Controls that could not be automatically matched to a process area')
    )
    process_areas['uncategorized'] = {'id': uid, 'pId': None}
    return uid


# ── 4. Process all ControlFromDocument records ──
cur.execute('''
    SELECT id, name, statement, "csfWho", "csfWhat", "csfWhen", 
           "csfWhere", "csfWhy", "csfHow", "csfEvidence", 
           "standard", "processAreaId"
    FROM "ControlFromDocument"
    ORDER BY "controlRef"
''')
controls = cur.fetchall()
total = len(controls)
print(f"\nProcessing {total} ControlFromDocument records...")

match_stats = {}
updated = 0
batch = []
BATCH_SIZE = 100

for i, ctrl in enumerate(controls):
    cid = ctrl[0]
    name = ctrl[1] or ''
    statement = ctrl[2] or ''
    standard_ref = ctrl[10] or ''

    # Combine CSF fields into search text
    csf_fields = ' '.join([ctrl[j] or '' for j in range(3, 10)])

    pa_id, method, confidence = match_to_process_area(name, statement, csf_fields, standard_ref)

    batch.append((pa_id, cid))
    match_stats[method] = match_stats.get(method, 0) + 1

    if len(batch) >= BATCH_SIZE:
        cur.executemany(
            'UPDATE "ControlFromDocument" SET "processAreaId" = %s WHERE id = %s',
            batch
        )
        updated += len(batch)
        print(f"  Updated {updated}/{total}...", end='\r')
        batch = []

# Final batch
if batch:
    cur.executemany(
        'UPDATE "ControlFromDocument" SET "processAreaId" = %s WHERE id = %s',
        batch
    )
    updated += len(batch)

print(f"\n  Updated {updated}/{total} records")

# ── 5. Show results ──
print(f"\n{'='*70}")
print("MATCHING RESULTS")
print(f"{'='*70}")
for method, count in sorted(match_stats.items(), key=lambda x: -x[1]):
    pct = count / total * 100
    print(f"  {method}: {count} ({pct:.1f}%)")

print(f"\n{'='*70}")
print("DISTRIBUTION BY PROCESS AREA")
print(f"{'='*70}")
cur.execute('''
    SELECT pa.name, COUNT(cfd.id) as cnt
    FROM "ControlFromDocument" cfd
    JOIN "ProcessArea" pa ON pa.id = cfd."processAreaId"
    GROUP BY pa.name
    ORDER BY cnt DESC
    LIMIT 30
''')
for row in cur.fetchall():
    bar = '█' * min(row[1] // 5, 60)
    print(f"  {row[0]:50s} {row[1]:4d} {bar}")

# ── 6. Show sample matches ──
print(f"\n{'='*70}")
print("SAMPLE MATCHES")
print(f"{'='*70}")
cur.execute('''
    SELECT cfd.name, pa.name as pa_name
    FROM "ControlFromDocument" cfd
    JOIN "ProcessArea" pa ON pa.id = cfd."processAreaId"
    WHERE pa.name != 'Uncategorized'
    ORDER BY RANDOM()
    LIMIT 15
''')
for row in cur.fetchall():
    print(f"  {row[0][:70]:70s} → {row[1]}")

cur.close()
conn.close()
print(f"\n✅ Done. {updated} ControlFromDocument records updated.")
