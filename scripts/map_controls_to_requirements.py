"""
Intelligent Control-to-Requirement Mapping Script
-------------------------------------------------
Maps controls to requirements based on text/content relevance
within the same ProcessArea. Uses keyword extraction and
multi-field cross-matching to determine meaningful relationships.

Usage:
    python scripts/map_controls_to_requirements.py
"""
import os, sys, uuid
from datetime import datetime
from pathlib import Path

# Add project root for db access
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import psycopg2
import re
from collections import defaultdict

# ── Database connection ──────────────────────────────────────────
env_path = PROJECT_ROOT / ".env"
DATABASE_URL = None
with open(env_path) as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            DATABASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# ── Load all data ────────────────────────────────────────────────
print("Loading controls...")
cur.execute('''
    SELECT id, name, statement, "controlType", "processAreaId", "controlRef"
    FROM "Control"
''')
controls = []
for row in cur.fetchall():
    controls.append({
        "id": row[0], "name": row[1] or "", "statement": row[2] or "",
        "controlType": row[3] or "", "processAreaId": row[4] or "",
        "controlRef": row[5] or ""
    })
print(f"  Loaded {len(controls)} controls")

print("Loading requirements...")
cur.execute('''
    SELECT "rID", "requirementId", "clauseContent", "intentOutcome", 
           "clauseApplicability", "processAreaId", standard
    FROM "Requirement"
''')
requirements = []
for row in cur.fetchall():
    requirements.append({
        "rId": row[0], "requirementId": row[1] or "",
        "clauseContent": row[2] or "", "intentOutcome": row[3] or "",
        "clauseApplicability": row[4] or "", "processAreaId": row[5] or "",
        "standard": row[6] or ""
    })
print(f"  Loaded {len(requirements)} requirements")

# ── Text processing helpers ──────────────────────────────────────

# Common stopwords + domain-specific noise words
STOPWORDS = set("""
the a an is are was were be been being have has had do does did will would
shall should may might must can could and or but if then else when where
which who whom whose why how what this that these those it its they them
their we us our you your he she his her to of in for on with at by from
about as into through during before after above below between under
again further then once here there all each every both few more most
other some such no nor not only own same so than too very just because
until while about across after against along among around before behind
below beneath beside between beyond down during except inside near
outside over past since through toward under until upon within without
management system shall ensure requirements shallbe thecontrol
""".split())

def tokenize(text: str) -> list[str]:
    """Extract meaningful lowercase tokens from text."""
    text = text.lower()
    # Remove punctuation, keep alphanumeric + spaces
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    tokens = text.split()
    # Filter stopwords and short tokens
    return [t for t in tokens if t not in STOPWORDS and len(t) > 2]

def extract_keywords(text: str, min_len: int = 4) -> set[str]:
    """Extract significant keywords from text."""
    tokens = tokenize(text)
    # Keep tokens of minimum length
    keywords = {t for t in tokens if len(t) >= min_len}
    # Also extract bigrams for more specific matching
    bigrams = set()
    for i in range(len(tokens) - 1):
        if len(tokens[i]) >= 3 and len(tokens[i+1]) >= 3:
            bigrams.add(f"{tokens[i]}_{tokens[i+1]}")
    return keywords | bigrams

def text_contains_keyword(text: str, keyword: str) -> bool:
    """Check if text contains a keyword (handles bigrams with underscore)."""
    if '_' in keyword:
        parts = keyword.split('_')
        return all(part in text.lower() for part in parts)
    return keyword in text.lower()

# ── Domain-specific matching rules ───────────────────────────────
# Maps control-type-specific terms to requirement content patterns
CONTROL_TYPE_KEYWORDS = {
    "Engineering": {"equipment", "asset", "hardware", "device", "machinery", "infrastructure",
                    "facility", "structural", "mechanical", "electrical", "instrumentation",
                    "pipeline", "vessel", "tank", "valve", "pressure"},
    "Procedural": {"procedure", "process", "workflow", "method", "protocol", "practice",
                   "guideline", "standard", "framework", "system"},
    "Analytical": {"analysis", "assessment", "evaluation", "calculation", "measurement",
                   "monitoring", "testing", "inspection", "review", "verification",
                   "modeling", "sampling", "survey", "audit"},
    "Behavioral": {"training", "competency", "behavior", "culture", "awareness",
                   "communication", "leadership", "accountability", "responsibility",
                   "personnel", "people", "human", "worker", "employee"},
    "Administrative": {"register", "record", "documentation", "reporting", "approval",
                       "authorization", "permit", "schedule", "plan", "budget",
                       "contract", "procurement", "inventory", "tracking"},
    "Informational": {"data", "information", "knowledge", "learning", "lesson",
                      "communication", "report", "dashboard", "metric", "indicator",
                      "kpi", "trend", "statistic", "database"},
}

# Domain concept groupings — if a requirement mentions these concepts, 
# look for controls with related keywords
CONCEPT_MAP = {
    "risk": {"risk", "hazard", "threat", "danger", "alarp", "bowtie", "hazop", "hazid",
             "qra", "risk assessment", "risk management", "risk register"},
    "emergency": {"emergency", "spill", "leak", "fire", "explosion", "evacuation",
                  "crisis", "disaster", "contingency", "erp", "response plan"},
    "maintenance": {"maintenance", "repair", "inspect", "overhaul", "shutdown",
                    "turnaround", "reliability", "condition monitoring", "predictive"},
    "safety": {"safety", "safe", "hse", "hsse", "health", "incident", "accident",
               "injury", "fatality", "loto", "permit to work", "ptw", "job safety"},
    "environmental": {"environmental", "emission", "discharge", "waste", "pollution",
                      "carbon", "greenhouse", "effluent", "remediation", "biodiversity",
                      "habitat", "spill", "contamination"},
    "quality": {"quality", "iso 9001", "nonconformance", "defect", "assurance",
                "qc", "qa", "inspection", "test", "calibration"},
    "competency": {"competency", "competence", "training", "qualification", "certified",
                   "skill", "capability", "knowledge", "experience", "development"},
    "contractor": {"contractor", "vendor", "supplier", "third party", "outsource",
                   "service provider", "subcontractor"},
    "transport": {"transport", "logistics", "fleet", "vehicle", "aviation", "marine",
                  "vessel", "shipping", "road", "rail", "dangerous goods", "dg"},
    "design": {"design", "engineering", "specification", "standard", "code",
               "drawing", "moc", "management of change", "technical"},
    "operations": {"operations", "operating", "production", "process", "plant",
                   "facility", "site", "offshore", "onshore", "operational"},
    "integrity": {"integrity", "asset integrity", "corrosion", "erosion", "degradation",
                  "inspection", "rbi", "ndt", "thickness", "pressure vessel"},
    "compliance": {"compliance", "regulatory", "regulation", "legal", "permit",
                   "license", "consent", "statutory", "obligation", "law"},
    "management_system": {"management system", "iso", "policy", "objective",
                          "kpi", "target", "continual improvement", "pdca"},
    "social": {"social", "community", "stakeholder", "indigenous", "livelihood",
               "human rights", "grievance", "resettlement", "impact assessment"},
    "security": {"security", "cyber", "ot security", "access control", "surveillance",
                 "guard", "perimeter", "monitor"},
    "health": {"health", "medical", "occupational health", "hygiene", "exposure",
               "wellness", "fitness for work", "fatigue", "ergonomics"},
}

# ── Scoring function ────────────────────────────────────────────

def score_control_to_requirement(control: dict, req: dict) -> float:
    """
    Compute a relevance score (0-100) between a control and a requirement.
    Only pairs in the same ProcessArea are considered.
    Returns 0 if no meaningful relationship.
    """
    # Must be in same ProcessArea
    if control["processAreaId"] != req["processAreaId"]:
        return 0
    
    score = 0.0
    
    # Combine requirement text fields
    req_text = f"{req['requirementId']} {req['clauseContent']} {req['intentOutcome']} {req['clauseApplicability']} {req['standard']}"
    ctrl_text = f"{control['name']} {control['statement']} {control['controlRef']}"
    
    req_keywords = extract_keywords(req_text, min_len=4)
    ctrl_keywords = extract_keywords(ctrl_text, min_len=4)
    
    # ── 1. Direct keyword overlap ───────────────────────────────
    # How many requirement keywords appear in the control text?
    req_in_ctrl = sum(1 for kw in req_keywords if text_contains_keyword(ctrl_text, kw))
    ctrl_in_req = sum(1 for kw in ctrl_keywords if text_contains_keyword(req_text, kw))
    
    overlap_ratio = 0
    if len(req_keywords) > 0:
        overlap_ratio = req_in_ctrl / len(req_keywords)
    
    score += overlap_ratio * 40  # Up to 40 points
    
    # ── 2. Control type relevance ───────────────────────────────
    ctrl_type = control.get("controlType", "")
    if ctrl_type in CONTROL_TYPE_KEYWORDS:
        type_kws = CONTROL_TYPE_KEYWORDS[ctrl_type]
        type_hits = sum(1 for kw in type_kws if kw in req_text.lower())
        if len(type_kws) > 0:
            score += (type_hits / len(type_kws)) * 20  # Up to 20 points
    
    # ── 3. Concept matching ─────────────────────────────────────
    req_concepts = set()
    for concept, keywords in CONCEPT_MAP.items():
        if any(kw in req_text.lower() for kw in keywords):
            req_concepts.add(concept)
    
    ctrl_concepts = set()
    for concept, keywords in CONCEPT_MAP.items():
        if any(kw in ctrl_text.lower() for kw in keywords):
            ctrl_concepts.add(concept)
    
    shared_concepts = req_concepts & ctrl_concepts
    if req_concepts:
        score += (len(shared_concepts) / len(req_concepts)) * 25  # Up to 25 points
    
    # ── 4. Name/ID prefix matching (e.g., "QMS-" prefix) ────────
    req_prefix = re.match(r'^([A-Za-z]+)', req.get("requirementId", ""))
    ctrl_ref = control.get("controlRef", "")
    if req_prefix and ctrl_ref:
        prefix = req_prefix.group(1).lower()
        if prefix in ctrl_ref.lower() or ctrl_ref.lower().startswith(prefix):
            score += 10  # Bonus
    
    # ── 5. Specific phrase matching ─────────────────────────────
    # Extract 2-3 word phrases from requirement and check in control
    req_tokens = tokenize(req_text)
    phrase_hits = 0
    for i in range(len(req_tokens) - 2):
        phrase = f"{req_tokens[i]} {req_tokens[i+1]} {req_tokens[i+2]}"
        if len(phrase) > 10 and phrase in ctrl_text.lower():
            phrase_hits += 1
    score += min(phrase_hits * 2, 10)  # Up to 10 points
    
    return min(score, 100.0)


# ── Main mapping logic ─────────────────────────────────────────

print("\nComputing mappings...")
THRESHOLD = 15.0  # Minimum score to create a mapping

# Group controls and requirements by ProcessArea for efficient lookup
controls_by_pa = defaultdict(list)
for c in controls:
    controls_by_pa[c["processAreaId"]].append(c)

reqs_by_pa = defaultdict(list)
for r in requirements:
    reqs_by_pa[r["processAreaId"]].append(r)

mappings = []
unmapped_controls = set(c["id"] for c in controls)
unmapped_reqs = set(r["rId"] for r in requirements)

pairs_scored = 0
pairs_mapped = 0

for pa_id in controls_by_pa:
    pa_controls = controls_by_pa[pa_id]
    pa_reqs = reqs_by_pa.get(pa_id, [])
    
    if not pa_reqs:
        continue  # No requirements in this PA — controls stay unmapped
    
    for ctrl in pa_controls:
        best_score = 0
        best_req = None
        
        for req in pa_reqs:
            pairs_scored += 1
            s = score_control_to_requirement(ctrl, req)
            
            if s >= THRESHOLD and s > best_score:
                best_score = s
                best_req = req
        
        # Map to the best matching requirement (above threshold)
        if best_req is not None:
            mappings.append({
                "controlId": ctrl["id"],
                "requirementRId": best_req["rId"],
                "processAreaId": pa_id,
                "score": best_score
            })
            pairs_mapped += 1
            unmapped_controls.discard(ctrl["id"])
            unmapped_reqs.discard(best_req["rId"])

print(f"  Scored {pairs_scored:,} control-requirement pairs")
print(f"  Created {pairs_mapped:,} mappings (threshold: {THRESHOLD})")
print(f"  Unmapped controls: {len(unmapped_controls)}")
print(f"  Unmapped requirements: {len(unmapped_reqs)}")

# ── Insert mappings ─────────────────────────────────────────────
print("\nInserting mappings into database...")
BATCH_SIZE = 500
batch = []
inserted = 0

for m in mappings:
    mapping_id = str(uuid.uuid4())
    batch.append((mapping_id, m["controlId"], m["requirementRId"], m["processAreaId"]))
    
    if len(batch) >= BATCH_SIZE:
        cur.executemany(
            'INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId") VALUES (%s, %s, %s, %s)',
            batch
        )
        inserted += len(batch)
        batch = []
        print(f"  Inserted {inserted:,}...")

if batch:
    cur.executemany(
        'INSERT INTO "MapControl2Requirement" ("id", "controlId", "requirementRId", "processAreaId") VALUES (%s, %s, %s, %s)',
        batch
    )
    inserted += len(batch)

conn.commit()
print(f"  Total inserted: {inserted:,}")

# ── Exception Reports ────────────────────────────────────────────
print("\n" + "="*70)
print("EXCEPTION REPORT 1: UNMAPPED REQUIREMENTS")
print("="*70)
print(f"Requirements with NO control mappings: {len(unmapped_reqs)}")
print()

if unmapped_reqs:
    # Get details for unmapped requirements
    unmapped_req_details = [r for r in requirements if r["rId"] in unmapped_reqs]
    # Sort by ProcessArea then requirementId
    unmapped_req_details.sort(key=lambda r: (r.get("standard", ""), r.get("requirementId", "")))
    
    cur_std = None
    for r in unmapped_req_details:
        std = r.get("standard", "Unknown")
        if std != cur_std:
            cur_std = std
            print(f"\n--- {std} ---")
        print(f"  [{r['rId']}] {r['requirementId']}")
        # Show abbreviated content
        content = r['clauseContent'][:120]
        print(f"      {content}{'...' if len(r['clauseContent']) > 120 else ''}")

print("\n" + "="*70)
print("EXCEPTION REPORT 2: UNMAPPED CONTROLS")
print("="*70)
print(f"Controls with NO requirement mappings: {len(unmapped_controls)}")
print()

if unmapped_controls:
    unmapped_ctrl_details = [c for c in controls if c["id"] in unmapped_controls]
    # Sort by ProcessArea
    unmapped_ctrl_details.sort(key=lambda c: c.get("processAreaId", ""))
    
    # Get PA names
    pa_names = {}
    cur.execute('SELECT id, name FROM "ProcessArea"')
    for row in cur.fetchall():
        pa_names[row[0]] = row[1]
    
    cur_pa = None
    for c in unmapped_ctrl_details:
        pa_name = pa_names.get(c.get("processAreaId", ""), "Unknown")
        if pa_name != cur_pa:
            cur_pa = pa_name
            print(f"\n--- {cur_pa} ---")
        print(f"  [{c['controlType']}] {c['name'][:100]}")
        if c.get('controlRef'):
            print(f"      Ref: {c['controlRef']}")

# ── Summary ─────────────────────────────────────────────────────
print("\n" + "="*70)
print("MAPPING SUMMARY")
print("="*70)
print(f"Total controls:            {len(controls):,}")
print(f"Total requirements:        {len(requirements):,}")
print(f"Mappings created:          {inserted:,}")
print(f"Unmapped controls:         {len(unmapped_controls)} ({len(unmapped_controls)/len(controls)*100:.1f}%)")
print(f"Unmapped requirements:     {len(unmapped_reqs)} ({len(unmapped_reqs)/len(requirements)*100:.1f}%)")
print(f"Mapping threshold:         {THRESHOLD}")

cur.close()
conn.close()
print("\nDone.")
